import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import clsx from 'clsx';
import { useJourneyStore, type JourneyNodeData } from '../stores/journeyStore';
import { useNavigate } from 'react-router-dom';

export const LurioNode = memo(({ data, isConnectable }: NodeProps<JourneyNodeData>) => {
    const { exploreNode, createNodeCourse } = useJourneyStore();
    const navigate = useNavigate();

    const isGenerated = data.status === 'completed';
    const isGenerating = data.status === 'generating';
    const hasCourse = !!data.courseId;

    return (
        <div className="group relative">
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-slate-400 !w-3 !h-3" />
            
            <div className={clsx(
                "w-64 p-4 rounded-2xl shadow-lg border-2 transition-all duration-300 backdrop-blur-sm",
                hasCourse
                    ? "bg-white dark:bg-slate-900 border-primary shadow-primary/20"
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-80 hover:opacity-100"
            )}>
                {/* Status Indicator */}
                <div className="flex justify-between items-start mb-2">
                    <span className={clsx(
                        "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                        isGenerated ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        isGenerating ? "bg-amber-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                        hasCourse ? "bg-slate-100 text-slate-500" :
                        "bg-slate-200 text-slate-500"
                    )}>
                        {isGenerated ? "Ready" : isGenerating ? "Building..." : hasCourse ? "Pending" : "Undiscovered"}
                    </span>
                    
                    {hasCourse && (
                        <button 
                            onClick={() => navigate(`/courses/${data.courseId}`)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-primary transition-colors"
                            title="Go to Course"
                        >
                            <span className="material-icons-round text-sm">open_in_new</span>
                        </button>
                    )}
                </div>

                <div className="font-display font-bold text-lg text-slate-800 dark:text-white mb-4 line-clamp-2">
                    {data.label}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                    {!hasCourse ? (
                        <button
                            onClick={() => createNodeCourse(data.id)}
                            className="w-full py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-all shadow-sm"
                        >
                            Start Learning
                        </button>
                    ) : (
                        isGenerated && !data.isDiscovered && (
                            <button
                                onClick={() => exploreNode(data.id)}
                                className="w-full py-2 border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-1"
                            >
                                <span className="material-icons-round text-sm">add_circle_outline</span>
                                Explore Deeper
                            </button>
                        )
                    )}
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!bg-slate-400 !w-3 !h-3" />
        </div>
    );
});
