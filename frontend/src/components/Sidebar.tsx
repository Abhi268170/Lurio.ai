import React from 'react';
import { useCourseStore, type Module } from '../stores/courseStore';
import clsx from 'clsx';
// import { CheckCircle, Circle, Loader2 } from 'lucide-react'; // Can add lucide-react later, using text/css for now

export const Sidebar: React.FC = () => {
    const { modules, activeModuleId, setActiveModule, flashcards } = useCourseStore();



    return (
        <aside className="w-full lg:w-72 shrink-0 h-full">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col transition-colors duration-200">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                    <h2 className="text-xs font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase">Modules</h2>
                </div>
                <nav className="p-2 space-y-1 flex-1 overflow-y-auto custom-scrollbar">
                    {modules.length === 0 ? (
                        <div className="text-center text-gray-500 py-8 px-4">
                            <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                            <p className="text-sm">Generating syllabus...</p>
                        </div>
                    ) : (
                        modules.map((module: Module) => (
                            <button
                                key={module.id}
                                onClick={() => setActiveModule(module.id)}
                                className={clsx(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group text-left",
                                    activeModuleId === module.id
                                        ? "bg-primary text-white shadow-md shadow-primary/20"
                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                )}
                            >
                                {/* Status Icons */}
                                {module.status === 'generating' && (
                                    <span className="material-icons-round text-sm animate-spin">refresh</span>
                                )}
                                {module.status === 'completed' && (
                                    <span className={clsx("material-icons-round text-sm", activeModuleId === module.id ? "text-white" : "text-green-500")}>check_circle</span>
                                )}
                                {module.status === 'pending' && (
                                    <span className={clsx("material-icons-round text-sm", activeModuleId === module.id ? "text-white/60" : "text-slate-300 dark:text-slate-600")}>lock</span>
                                )}
                                {module.status === 'failed' && (
                                    <span className="material-icons-round text-sm text-red-500">error</span>
                                )}

                                <span className="text-sm font-medium truncate">{module.title}</span>
                            </button>
                        ))
                    )}
                </nav>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 mt-auto flex-shrink-0 space-y-2">
                    <button
                        onClick={() => useCourseStore.getState().toggleFlashcardDeck(true)}
                        disabled={!activeModuleId || (modules.find(m => m.id === activeModuleId)?.status !== 'completed')}
                        className={clsx(
                            "w-full flex items-center justify-center gap-2 py-2 text-xs font-bold border rounded-lg transition-all uppercase",
                            (!activeModuleId || (modules.find(m => m.id === activeModuleId)?.status !== 'completed'))
                                ? "bg-transparent text-slate-300 border-slate-200 dark:border-slate-700 dark:text-slate-600 cursor-not-allowed"
                                : "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40"
                        )}
                    >
                        <span className="material-icons-round text-sm">style</span>
                        {flashcards[activeModuleId || 0] ? "Flashcards" : "Generate Flashcards"}
                    </button>

                    {/* Final Revision Button */}
                    {(() => {
                        const lessonModules = modules.filter(m => m.module_type === 'lesson' || !m.module_type); // Default to lesson if undefined
                        const areLessonsCompleted = lessonModules.length > 0 && lessonModules.every(m => m.is_completed_by_user);
                        const quizModule = modules.find(m => m.module_type === 'quiz');

                        if (areLessonsCompleted) {
                            return (
                                <button
                                    onClick={() => useCourseStore.getState().generateFinalRevision()}
                                    className={clsx(
                                        "w-full flex items-center justify-center gap-2 py-2 text-xs font-bold border rounded-lg transition-all uppercase",
                                        "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                                    )}
                                >
                                    <span className="material-icons-round text-sm">assignment_turned_in</span>
                                    {quizModule ? "Final Revision" : "Take Final Exam"}
                                </button>
                            );
                        }
                        return null;
                    })()}

                </div>
            </div>
        </aside>
    );
};
