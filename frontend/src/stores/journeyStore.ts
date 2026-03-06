import { create } from 'zustand';
import { type Node, type Edge, type Connection, addEdge, applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from 'reactflow';
import dagre from 'dagre';
import { useAuthStore } from './useAuthStore';

export interface JourneyNodeData {
    id: number;
    label: string;
    courseId?: number | null;
    status?: 'pending' | 'generating' | 'completed' | 'failed' | null;
    isDiscovered: boolean;
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 260;
const nodeHeight = 160;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
    dagreGraph.setGraph({ rankdir: direction, ranksep: 100, nodesep: 80 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    return nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        };
    });
};

interface JourneyStore {
    journeyId: number | null;
    topic: string;
    nodes: Node<JourneyNodeData>[];
    edges: Edge[];
    
    // Actions
    setJourney: (id: number, topic: string) => void;
    setGraph: (nodes: any[], edges?: any[]) => void;
    
    // ReactFlow Actions
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    
    // Journey Actions
    exploreNode: (nodeId: number) => Promise<void>;
    createNodeCourse: (nodeId: number) => Promise<void>;
}

export const useJourneyStore = create<JourneyStore>((set, get) => ({
    journeyId: null,
    topic: '',
    nodes: [],
    edges: [],

    setJourney: (id, topic) => set({ journeyId: id, topic }),
    
    setGraph: (backendNodes, backendEdges = []) => {
        // Transform backend nodes to ReactFlow nodes
        const rfNodes: Node[] = backendNodes.map(n => ({
            id: n.id.toString(),
            type: 'lurioNode',
            position: { x: n.x_position, y: n.y_position },
            data: { 
                id: n.id,
                label: n.topic, 
                courseId: n.course_id, 
                status: n.status,
                isDiscovered: n.is_discovered
            }
        }));

        // Generate edges based on parent_id
        let rfEdges: Edge[] = [];
        if (backendEdges.length === 0) {
            rfEdges = backendNodes
                .filter(n => n.parent_id)
                .map(n => ({
                    id: `e${n.parent_id}-${n.id}`,
                    source: n.parent_id.toString(),
                    target: n.id.toString(),
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: '#64748b', strokeWidth: 2 }
                }));
        } else {
            rfEdges = backendEdges;
        }

        const layoutedNodes = getLayoutedElements(rfNodes, rfEdges);
        set({ nodes: layoutedNodes, edges: rfEdges });
    },

    onNodesChange: (changes) => set({
        nodes: applyNodeChanges(changes, get().nodes),
    }),
    onEdgesChange: (changes) => set({
        edges: applyEdgeChanges(changes, get().edges),
    }),
    onConnect: (connection) => set({
        edges: addEdge(connection, get().edges),
    }),

    exploreNode: async (nodeId: number) => {
        try {
            const token = useAuthStore.getState().token;
            const response = await fetch(`http://localhost:8000/api/v1/journeys/nodes/${nodeId}/explore`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            
            if (response.ok) {
                const newNodes = await response.json();
                
                // Prepare the data for layout calculation
                const currentNodes = get().nodes;
                const currentEdges = get().edges;

                const rfNewNodes = newNodes.map((n: any) => ({
                    id: n.id.toString(),
                    type: 'lurioNode',
                    position: { x: 0, y: 0 }, // Position will be set by layout
                    data: { 
                        id: n.id,
                        label: n.topic, 
                        courseId: n.course_id, 
                        status: n.status,
                        isDiscovered: n.is_discovered 
                    }
                }));
                
                const rfNewEdges = newNodes.map((n: any) => ({
                    id: `e${n.parent_id}-${n.id}`,
                    source: n.parent_id.toString(),
                    target: n.id.toString(),
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: '#64748b', strokeWidth: 2 }
                }));

                const allNodes = [...currentNodes, ...rfNewNodes];
                const allEdges = [...currentEdges, ...rfNewEdges];

                // Re-calculate layout for everything to avoid overlaps
                const layoutedNodes = getLayoutedElements(
                    allNodes.map(n => n.data.id === nodeId ? { ...n, data: { ...n.data, isDiscovered: true } } : n),
                    allEdges
                );

                set({ 
                    nodes: layoutedNodes, 
                    edges: allEdges 
                });
            }
        } catch (error) {
            console.error("Failed to explore node", error);
        }
    },

    createNodeCourse: async (nodeId: number) => {
        try {
            const token = useAuthStore.getState().token;
            const response = await fetch(`http://localhost:8000/api/v1/journeys/nodes/${nodeId}/create-course`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            
            if (response.ok) {
                const updatedNode = await response.json();
                
                set(state => ({
                    nodes: state.nodes.map(n => 
                        n.data.id === nodeId ? {
                            ...n,
                            data: {
                                ...n.data,
                                courseId: updatedNode.course_id,
                                status: updatedNode.status
                            }
                        } : n
                    )
                }));
            }
        } catch (error) {
            console.error("Failed to create course for node", error);
        }
    }
}));
