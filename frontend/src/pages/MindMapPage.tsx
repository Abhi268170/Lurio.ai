import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    ReactFlowProvider,
    useReactFlow,
    Handle,
    Position,
    applyNodeChanges,
    applyEdgeChanges,
    type Node,
    type Edge,
    type NodeProps,
    type NodeChange,
    type EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { useAuthStore } from '../stores/useAuthStore';
import { useTheme } from '../hooks/useTheme';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MindNode {
    concept: string;
    children?: MindNode[];
}

interface MindMapNodeData {
    concept: string;
    path: string;
    depth: number;
    hasChildren: boolean;
    isExpanded: boolean;
    rawChildren: MindNode[];
}

// ─── Layout constants (must match dagre config) ───────────────────────────────
const NODE_W = 256;
const NODE_H = 110;

function isDescendant(id: string, ancestorPath: string): boolean {
    return id.startsWith(ancestorPath + '.');
}

function getLayoutedElements(nodes: Node[], edges: Edge[]): Node[] {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 60 });
    nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
    edges.forEach(e => g.setEdge(e.source, e.target));
    dagre.layout(g);
    return nodes.map(n => {
        const pos = g.node(n.id);
        return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
    });
}

// ─── Custom Node (matches LurioNode card style) ───────────────────────────────
const MindMapNodeComponent = React.memo(({ data }: NodeProps<MindMapNodeData>) => {
    const isRoot = data.depth === 0;
    return (
        <div className="group relative">
            <Handle
                type="target"
                position={Position.Top}
                className="!bg-slate-400 !w-3 !h-3"
            />
            <div
                className={[
                    'w-64 p-4 rounded-2xl shadow-lg border-2 transition-all duration-300 backdrop-blur-sm',
                    isRoot
                        ? 'bg-white dark:bg-slate-900 border-primary shadow-primary/20'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:shadow-md',
                ].join(' ')}
            >
                {/* Top row: depth badge + expand indicator */}
                <div className="flex justify-between items-start mb-2">
                    <span className={[
                        'text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full',
                        isRoot
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : data.isExpanded
                                ? 'bg-primary/10 text-primary'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
                    ].join(' ')}>
                        {isRoot ? 'Core Topic' : data.isExpanded ? 'Expanded' : 'Concept'}
                    </span>
                    {data.hasChildren && (
                        <span className={[
                            'text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center transition-colors',
                            data.isExpanded
                                ? 'bg-primary text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 group-hover:bg-primary/20 group-hover:text-primary',
                        ].join(' ')}>
                            {data.isExpanded ? '−' : '+'}
                        </span>
                    )}
                </div>

                {/* Concept label */}
                <div className="font-display font-bold text-base text-slate-800 dark:text-white line-clamp-2 leading-snug">
                    {data.concept}
                </div>

                {/* Hint text */}
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                    {data.hasChildren
                        ? 'Click to explore · Double-click for explanation'
                        : 'Double-click for explanation'}
                </p>
            </div>
            <Handle
                type="source"
                position={Position.Bottom}
                className="!bg-slate-400 !w-3 !h-3"
            />
        </div>
    );
});

const nodeTypes = { mindMapNode: MindMapNodeComponent };

// ─── Canvas ───────────────────────────────────────────────────────────────────
const MindMapCanvas: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { fitView } = useReactFlow();
    const { theme } = useTheme();

    const [courseTitle, setCourseTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [nodes, setNodes] = useState<Node<MindMapNodeData>[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [definition, setDefinition] = useState<{ concept: string; text: string } | null>(null);
    const [defLoading, setDefLoading] = useState(false);

    const nodesRef = useRef<Node<MindMapNodeData>[]>([]);
    const edgesRef = useRef<Edge[]>([]);
    const expandedRef = useRef<Set<string>>(new Set());
    const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => { nodesRef.current = nodes; }, [nodes]);
    useEffect(() => { edgesRef.current = edges; }, [edges]);

    // Load mindmap
    useEffect(() => {
        const load = async () => {
            const token = useAuthStore.getState().token;
            const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
            const [cr, mr] = await Promise.all([
                fetch(`http://localhost:8000/api/v1/courses/${id}`, { headers }),
                fetch(`http://localhost:8000/api/v1/courses/${id}/mindmap`, { headers }),
            ]);
            if (cr.ok) setCourseTitle((await cr.json()).title);
            if (mr.ok) {
                const data: MindNode = await mr.json();
                const rootNode: Node<MindMapNodeData> = {
                    id: 'root',
                    type: 'mindMapNode',
                    position: { x: 0, y: 0 },
                    data: {
                        concept: data.concept,
                        path: 'root',
                        depth: 0,
                        hasChildren: (data.children?.length ?? 0) > 0,
                        isExpanded: false,
                        rawChildren: data.children ?? [],
                    },
                };
                setNodes([rootNode]);
            }
            setLoading(false);
        };
        load();
    }, [id]);

    // Fit view when node count changes
    useEffect(() => {
        if (nodes.length === 0) return;
        const t = setTimeout(() => fitView({ padding: 0.25, duration: 400 }), 80);
        return () => clearTimeout(t);
    }, [nodes.length, fitView]);

    const toggleNode = useCallback((path: string, rawChildren: MindNode[], depth: number) => {
        const isExpanded = expandedRef.current.has(path);

        if (isExpanded) {
            expandedRef.current.delete(path);
            const newEdges = edgesRef.current.filter(e => !isDescendant(e.target, path));
            const keptNodes = nodesRef.current
                .filter(n => !isDescendant(n.id, path))
                .map(n => n.id === path ? { ...n, data: { ...n.data, isExpanded: false } } : n);
            setNodes(getLayoutedElements(keptNodes, newEdges));
            setEdges(newEdges);
        } else {
            expandedRef.current.add(path);
            const childNodes: Node<MindMapNodeData>[] = rawChildren.map((child, i) => ({
                id: `${path}.${i}`,
                type: 'mindMapNode',
                position: { x: 0, y: 0 },
                data: {
                    concept: child.concept,
                    path: `${path}.${i}`,
                    depth: depth + 1,
                    hasChildren: (child.children?.length ?? 0) > 0,
                    isExpanded: false,
                    rawChildren: child.children ?? [],
                },
            }));
            const childEdges: Edge[] = rawChildren.map((_, i) => ({
                id: `e-${path}-${path}.${i}`,
                source: path,
                target: `${path}.${i}`,
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#64748b', strokeWidth: 2 },
            }));
            const allNodes = [
                ...nodesRef.current.map(n =>
                    n.id === path ? { ...n, data: { ...n.data, isExpanded: true } } : n
                ),
                ...childNodes,
            ];
            const allEdges = [...edgesRef.current, ...childEdges];
            setNodes(getLayoutedElements(allNodes, allEdges));
            setEdges(allEdges);
        }
    }, []);

    const openDefinition = useCallback(async (concept: string) => {
        setDefinition({ concept, text: '' });
        setDefLoading(true);
        try {
            const token = useAuthStore.getState().token;
            const res = await fetch(`http://localhost:8000/api/v1/courses/${id}/mindmap/define`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ concept }),
            });
            const data = res.ok ? await res.json() : null;
            setDefinition({ concept, text: data?.definition ?? 'Could not fetch definition.' });
        } catch {
            setDefinition({ concept, text: 'Could not fetch definition.' });
        } finally {
            setDefLoading(false);
        }
    }, [id]);

    // Single-click = expand, double-click = define
    const handleNodeClick = useCallback((_: React.MouseEvent, node: Node<MindMapNodeData>) => {
        if (clickTimerRef.current) return;
        clickTimerRef.current = setTimeout(() => {
            clickTimerRef.current = null;
            if (node.data.hasChildren) {
                toggleNode(node.data.path, node.data.rawChildren, node.data.depth);
            }
        }, 220);
    }, [toggleNode]);

    const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node<MindMapNodeData>) => {
        if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
        }
        openDefinition(node.data.concept);
    }, [openDefinition]);

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes(prev => applyNodeChanges(changes, prev) as Node<MindMapNodeData>[]),
        []
    );
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges(prev => applyEdgeChanges(changes, prev)),
        []
    );

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                    <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
                    <span className="text-sm">Building mind map…</span>
                </div>
            </div>
        );
    }

    if (nodes.length === 0) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400">
                <div className="text-center">
                    <span className="material-icons-round text-4xl block mb-3">error_outline</span>
                    <p>Mind map not available.</p>
                    <button onClick={() => navigate(-1)} className="mt-4 text-primary hover:text-primary/80 text-sm">Go back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
            {/* Header overlay — matches JourneyPage exactly */}
            <div className="absolute top-0 left-0 right-0 z-10 p-6 flex justify-between items-center pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                        <span className="material-icons-round">arrow_back</span>
                    </button>
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Mind Map</span>
                        <h1 className="font-display font-bold text-slate-800 dark:text-white truncate max-w-xs">
                            {courseTitle}
                        </h1>
                    </div>
                </div>
                <div className="pointer-events-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2 text-slate-500 text-xs">
                    <span className="material-icons-round text-sm">touch_app</span>
                    Click to expand
                    <span className="text-slate-300 dark:text-slate-600 mx-1">·</span>
                    <span className="material-icons-round text-sm">ads_click</span>
                    Double-click for explanation
                </div>
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                minZoom={0.2}
                maxZoom={2}
                className="bg-slate-50 dark:bg-slate-950"
            >
                <Background color={theme === 'dark' ? '#334155' : '#cbd5e1'} gap={20} />
                <Controls className="!bg-white dark:!bg-slate-800 !border-slate-200 dark:!border-slate-700 !shadow-lg rounded-xl overflow-hidden [&>button]:!border-b-slate-200 dark:[&>button]:!border-b-slate-700 [&>button]:!fill-slate-600 dark:[&>button]:!fill-slate-400" />
                <MiniMap
                    className="!bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-800 !shadow-lg rounded-xl overflow-hidden"
                    maskColor={theme === 'dark' ? '#1e293b' : '#f1f5f9'}
                    nodeColor={theme === 'dark' ? '#475569' : '#e2e8f0'}
                />
            </ReactFlow>

            {/* Definition modal */}
            {definition && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    onClick={() => setDefinition(null)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <h3 className="font-display font-bold text-slate-800 dark:text-white text-lg leading-tight">
                                {definition.concept}
                            </h3>
                            <button
                                onClick={() => setDefinition(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mt-0.5 flex-shrink-0 transition-colors"
                            >
                                <span className="material-icons-round text-sm">close</span>
                            </button>
                        </div>
                        {defLoading ? (
                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
                                Generating explanation…
                            </div>
                        ) : (
                            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                {definition.text}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export const MindMapPage: React.FC = () => (
    <ReactFlowProvider>
        <MindMapCanvas />
    </ReactFlowProvider>
);
