import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, { 
    Background, 
    Controls, 
    MiniMap, 
    ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useJourneyStore } from '../stores/journeyStore';
import { useAuthStore } from '../stores/useAuthStore';
import { LurioNode } from '../components/LurioNode';
import { useTheme } from '../hooks/useTheme';

const nodeTypes = { lurioNode: LurioNode };

const JourneyCanvas: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { theme } = useTheme();
    const { 
        nodes, 
        edges, 
        setGraph, 
        setJourney,
        onNodesChange, 
        onEdgesChange, 
        onConnect 
    } = useJourneyStore();

    useEffect(() => {
        if (!id) return;
        
        const fetchJourney = async () => {
            try {
                const token = useAuthStore.getState().token;
            const response = await fetch(`http://localhost:8000/api/v1/journeys/${id}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
                if (response.ok) {
                    const data = await response.json();
                    setJourney(data.id, data.topic);
                    setGraph(data.nodes);
                }
            } catch (error) {
                console.error("Failed to load journey", error);
            }
        };
        
        fetchJourney();
    }, [id, setJourney, setGraph]);

    return (
        <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
            {/* Header Overlay */}
            <div className="absolute top-0 left-0 right-0 z-10 p-6 flex justify-between items-center pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/courses')}
                        className="bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                        <span className="material-icons-round">arrow_back</span>
                    </button>
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Journey</span>
                        <h1 className="font-display font-bold text-slate-800 dark:text-white">
                            {useJourneyStore.getState().topic || 'Loading...'}
                        </h1>
                    </div>
                </div>
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
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
        </div>
    );
};

export const JourneyPage: React.FC = () => (
    <ReactFlowProvider>
        <JourneyCanvas />
    </ReactFlowProvider>
);
