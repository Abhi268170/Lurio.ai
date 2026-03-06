import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'neutral' });

const MermaidBlock: React.FC<{ code: string }> = ({ code }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        mermaid.render(id, code)
            .then(({ svg }) => { if (ref.current) ref.current.innerHTML = svg; })
            .catch(() => { if (ref.current) ref.current.innerHTML = `<pre>${code}</pre>`; });
    }, [code]);
    return <div ref={ref} className="my-4 flex justify-center overflow-x-auto" />;
};
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useCourseStore } from '../stores/courseStore';
import clsx from 'clsx';
import { QuizView } from './QuizView';
import { FloatingNotebook } from './FloatingNotebook';

export const ContentArea: React.FC = () => {
    const {
        activeModuleId,
        moduleContent,
        modules,
        setActiveModule,
        openChatWithText,
        togglePappyChat,
        toggleChat,
        isChatOpen,
        moduleAudioStatus,
        generateModuleAudio,
        fetchModuleAudioUrl,
        regenerateModule,
    } = useCourseStore();

    const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(null);
    const [isNotebookOpen, setIsNotebookOpen] = useState(false);
    const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);
    const [selectedDifficulty, setSelectedDifficulty] = useState('intermediate');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const navigate = useNavigate();

    // Reset panels when active module changes
    useEffect(() => {
        if (activeModuleId !== null) {
            setAudioUrl(null);
            setIsRegenerateOpen(false);
        }
    }, [activeModuleId]);

    const handleGenerateAudio = async () => {
        if (activeModuleId === null) return;
        await generateModuleAudio(activeModuleId);
    };

    const handlePlayAudio = async () => {
        if (activeModuleId === null) return;
        if (audioUrl) {
            setAudioUrl(null); // toggle off
            return;
        }
        setIsLoadingAudio(true);
        const url = await fetchModuleAudioUrl(activeModuleId);
        setIsLoadingAudio(false);
        if (url) setAudioUrl(url);
    };

    const handleRegenerate = async () => {
        if (activeModuleId === null) return;
        await regenerateModule(activeModuleId, selectedDifficulty);
        setIsRegenerateOpen(false);
    };

    const currentAudioStatus = activeModuleId ? moduleAudioStatus[activeModuleId] : null;

    const activeModuleIndex = modules.findIndex(m => m.id === activeModuleId);
    const activeModule = modules[activeModuleIndex];
    let content = activeModuleId ? moduleContent[activeModuleId] : '';

    // Graceful Fix: Remove duplicate title from markdown content if present
    if (activeModule && content && activeModule.module_type !== 'quiz') {
        // Escape regex special characters in title
        const escapedTitle = activeModule.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const titlePattern = new RegExp(`^#\\s*${escapedTitle}\\s*`, 'i');
        content = content.replace(titlePattern, '').trim();
    }

    if (!activeModule) {
        return (
            <article className="flex-1 min-w-0 h-full">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none h-full flex flex-col items-center justify-center text-center p-8 transition-colors duration-200">
                    <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                        <span className="material-icons-round text-4xl text-slate-300 dark:text-slate-600">auto_stories</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Ready to Start?</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                        Select a module from the sidebar to begin learning, or wait for the syllabus to generate.
                    </p>
                </div>
            </article>
        );
    }

    const handlePrevious = () => {
        if (activeModuleIndex > 0) {
            setActiveModule(modules[activeModuleIndex - 1].id);
        }
    };

    const handleNext = () => {
        if (activeModuleIndex < modules.length - 1) {
            setActiveModule(modules[activeModuleIndex + 1].id);
        }
    };

    const handleTextSelection = () => {
        const selectedText = window.getSelection()?.toString().trim();
        console.log('Text selected:', selectedText);
        if (selectedText && selectedText.length > 0) {
            const range = window.getSelection()?.getRangeAt(0);
            const rect = range?.getBoundingClientRect();

            if (rect) {
                console.log('Setting selection tooltip at:', { top: rect.top - 50, left: rect.left + rect.width / 2 });
                setSelection({
                    text: selectedText,
                    top: rect.top - 50,
                    left: rect.left + rect.width / 2
                });
            }
        } else {
            setSelection(null);
        }
    };

    const handleAskPopo = () => {
        console.log('Ask Popo clicked! Selection:', selection);
        if (selection) {
            console.log('Opening PopoChat with text:', selection.text);
            openChatWithText(selection.text);
            setSelection(null);
        } else {
            console.log('No selection found!');
        }
    };

    // Check if all modules are completed (course is ready for quiz)
    // Filter out the quiz itself from the check
    const lessons = modules.filter(m => m.module_type !== 'quiz');
    const allLessonsCompleted = lessons.every(m => m.is_completed_by_user);

    // Check if the current module is locked (is quiz AND not all lessons completed)
    // AND check that we are not viewing a previously completed quiz (if re-viewing)
    const isQuiz = activeModule.module_type === 'quiz';
    const isLocked = isQuiz && !allLessonsCompleted;

    const handleTeachPappy = () => {
        if (isChatOpen) toggleChat(false);
        togglePappyChat(true);
    };

    // Check if all modules (including quiz) are completed for text selection logic
    const allModulesCompleted = modules.every(m => m.status === 'completed'); // This is generation status, not user status. Keep as is for selection logic.


    return (
        <article className="flex-1 min-w-0 h-full">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden h-full transition-colors duration-200 flex flex-col">
                <div className="p-8 pb-4 border-b border-slate-50 dark:border-slate-800/50 flex-shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-primary font-bold text-xs tracking-widest uppercase">
                            <span className="material-icons-round text-xs">auto_fix_high</span>
                            AI-Generated Course Module
                        </div>
                        {!isQuiz && activeModule.status === 'completed' && (
                            <div className="flex items-center gap-1">
                                {/* Notebook toggle */}
                                <button
                                    onClick={() => setIsNotebookOpen(v => !v)}
                                    title="Open Notebook"
                                    className={clsx("p-2 rounded-lg text-sm transition-colors flex items-center gap-1.5 font-semibold",
                                        isNotebookOpen ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" : "text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                    )}
                                >
                                    <span className="material-icons-round text-base">menu_book</span>
                                    <span className="text-xs hidden sm:inline">Notebook</span>
                                </button>

                                {/* Audio button */}
                                {!currentAudioStatus && (
                                    <button
                                        onClick={handleGenerateAudio}
                                        title="Generate audio for this module"
                                        className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors flex items-center gap-1.5 text-sm font-semibold"
                                    >
                                        <span className="material-icons-round text-base">record_voice_over</span>
                                        <span className="text-xs hidden sm:inline">Audio</span>
                                    </button>
                                )}
                                {currentAudioStatus === 'generating' && (
                                    <span className="p-2 flex items-center gap-1.5 text-xs text-amber-500 font-semibold animate-pulse">
                                        <span className="material-icons-round text-base">hourglass_top</span>
                                        <span className="hidden sm:inline">Generating...</span>
                                    </span>
                                )}
                                {currentAudioStatus === 'completed' && (
                                    <button
                                        onClick={handlePlayAudio}
                                        disabled={isLoadingAudio}
                                        title={audioUrl ? "Hide audio player" : "Play module audio"}
                                        className={clsx("p-2 rounded-lg transition-colors flex items-center gap-1.5 text-sm font-semibold",
                                            audioUrl ? "bg-primary/10 text-primary" : "text-slate-400 hover:text-primary hover:bg-primary/5"
                                        )}
                                    >
                                        <span className="material-icons-round text-base">{isLoadingAudio ? 'hourglass_top' : audioUrl ? 'volume_up' : 'headphones'}</span>
                                        <span className="text-xs hidden sm:inline">Listen</span>
                                    </button>
                                )}

                                {/* Regenerate toggle */}
                                <button
                                    onClick={() => setIsRegenerateOpen(v => !v)}
                                    title="Regenerate at different difficulty"
                                    className={clsx("p-2 rounded-lg text-sm transition-colors flex items-center gap-1.5 font-semibold",
                                        isRegenerateOpen ? "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400" : "text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                                    )}
                                >
                                    <span className="material-icons-round text-base">tune</span>
                                    <span className="text-xs hidden sm:inline">Difficulty</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <h2 className="text-4xl font-display font-bold text-slate-900 dark:text-white mb-2">{activeModule.title}</h2>

                    {/* Audio Player */}
                    {audioUrl && (
                        <div className="mt-3 flex items-center gap-3 p-3 bg-primary/5 rounded-xl">
                            <span className="material-icons-round text-primary text-sm">headphones</span>
                            <audio ref={audioRef} controls className="flex-1 h-8" src={audioUrl} />
                        </div>
                    )}

                    {/* Regenerate Panel */}
                    {isRegenerateOpen && (
                        <div className="mt-3 p-4 bg-violet-50 dark:bg-violet-900/10 rounded-xl border border-violet-100 dark:border-violet-900/30 flex flex-wrap items-center gap-3">
                            <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Regenerate at:</span>
                            {(['beginner', 'intermediate', 'advanced'] as const).map(d => (
                                <button
                                    key={d}
                                    onClick={() => setSelectedDifficulty(d)}
                                    className={clsx("px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors",
                                        selectedDifficulty === d
                                            ? "bg-violet-600 text-white"
                                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-violet-400"
                                    )}
                                >{d}</button>
                            ))}
                            <button
                                onClick={handleRegenerate}
                                className="ml-auto px-4 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors flex items-center gap-1.5"
                            >
                                <span className="material-icons-round text-sm">refresh</span>
                                Regenerate
                            </button>
                        </div>
                    )}

                </div>

                <div className="flex-1 p-8 overflow-y-auto" onMouseUp={allModulesCompleted && !isQuiz ? handleTextSelection : undefined}>
                    {activeModule.status === 'pending' ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <div className="w-64 h-64 mb-6">
                                <DotLottieReact
                                    src="https://lottie.host/b64d1b32-922c-44a7-8561-46adf7a60619/xxqJYMc9rU.lottie"
                                    loop
                                    autoplay
                                />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Coming Soon!</h3>
                            <p className="text-slate-600 dark:text-slate-400 max-w-md">
                                Go through previous modules till I prepare for the lecture
                            </p>
                        </div>
                    ) : isLocked ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                                <span className="material-icons-round text-5xl text-slate-400 dark:text-slate-500">lock</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Locked</h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                                Complete all previous lesson modules to unlock the Final Revision.
                            </p>
                        </div>
                    ) : isQuiz ? (
                        <QuizView content={content} moduleId={activeModule.id} userData={activeModule.user_data} />
                    ) : (
                        <div className="prose prose-slate dark:prose-invert max-w-none markdown-content font-sans">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                    code(props) {
                                        const { children, className, ...rest } = props;
                                        const match = /language-(\w+)/.exec(className || '');
                                        if (match?.[1] === 'mermaid') {
                                            return <MermaidBlock code={String(children).replace(/\n$/, '')} />;
                                        }
                                        return <code {...rest} className={className}>{children}</code>;
                                    }
                                }}
                            >
                                {content}
                            </ReactMarkdown>

                            {activeModule.status === 'generating' && (
                                <div className="flex items-center gap-2 mt-4 text-primary">
                                    <span className="inline-block w-2 h-2 bg-current rounded-full animate-bounce"></span>
                                    <span className="inline-block w-2 h-2 bg-current rounded-full animate-bounce delay-75"></span>
                                    <span className="inline-block w-2 h-2 bg-current rounded-full animate-bounce delay-150"></span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Ask Popo Tooltip */}
                    {selection && allModulesCompleted && !isQuiz && (
                        <div
                            className="fixed z-40 bg-primary text-white px-4 py-2 rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition-opacity"
                            style={{ top: `${selection.top}px`, left: `${selection.left}px`, transform: 'translateX(-50%)' }}
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent text deselection
                                handleAskPopo();
                            }}
                        >
                            <span className="text-sm font-semibold">Ask Popo</span>
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                    <button
                        onClick={handlePrevious}
                        disabled={activeModuleIndex === 0}
                        className={clsx(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold transition-colors",
                            activeModuleIndex === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                        )}
                    >
                        <span className="material-icons-round text-sm">arrow_back</span>
                        Previous
                    </button>

                    <div className="flex gap-4">
                        {!isQuiz && (
                            <button
                                onClick={handleTeachPappy}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-teal-200 dark:border-teal-900 text-teal-600 dark:text-teal-400 font-semibold hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all"
                            >
                                <span className="material-icons-round text-sm">school</span>
                                Teach Pappy
                            </button>
                        )}

                        {!isQuiz && (
                            <button
                                onClick={() => {
                                    if (activeModule.is_completed_by_user) {
                                        // If already completed, just toggle back without checkpoint
                                        useCourseStore.getState().toggleModuleComplete(activeModule.id);
                                    } else {
                                        // If marking as complete, trigger checkpoint
                                        useCourseStore.getState().openCheckpoint(activeModule.id);
                                    }
                                }}
                                disabled={activeModuleIndex !== 0 && !modules[activeModuleIndex - 1]?.is_completed_by_user}
                                className={clsx(
                                    "flex items-center gap-2 px-8 py-2.5 rounded-xl font-semibold transition-all shadow-sm",
                                    activeModule.is_completed_by_user
                                        ? "bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                                        : (activeModuleIndex !== 0 && !modules[activeModuleIndex - 1]?.is_completed_by_user)
                                            ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-600"
                                            : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700"
                                )}
                            >
                                {activeModule.is_completed_by_user ? (
                                    <>
                                        <span className="material-icons-round text-sm">check_circle</span>
                                        Completed
                                    </>
                                ) : (
                                    <>
                                        <span className="material-icons-round text-sm">check_circle_outline</span>
                                        Mark as Finished
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {activeModule.module_type === 'quiz' || activeModuleIndex === modules.length - 1 ? (
                        <button
                            onClick={() => navigate('/courses')}
                            className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-primary text-white font-semibold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                        >
                            Finish Course
                            <span className="material-icons-round text-sm">flag</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            disabled={activeModuleIndex === modules.length - 1}
                            className={clsx(
                                "flex items-center gap-2 px-8 py-2.5 rounded-xl bg-primary text-white font-semibold shadow-lg shadow-primary/20",
                                activeModuleIndex === modules.length - 1 ? "opacity-50 cursor-not-allowed" : "hover:opacity-90 transition-opacity"
                            )}
                        >
                            Next Module
                            <span className="material-icons-round text-sm">arrow_forward</span>
                        </button>
                    )}
                </div>
            </div>

            <FloatingNotebook
                isOpen={isNotebookOpen}
                onClose={() => setIsNotebookOpen(false)}
                initialModuleId={activeModuleId}
            />

            <div className="mt-6 flex flex-col md:flex-row gap-4 items-center justify-between px-4">
                <div className="flex items-center gap-4">

                    <button className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-primary transition-colors">
                        <span className="material-icons-round text-base">forum</span>
                        DISCUSS (24)
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-primary transition-colors">
                        <span className="material-icons-round text-base">bookmark_border</span>
                        SAVE MODULE
                    </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                    Was this AI-generated content helpful?
                    <button className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-300 hover:text-green-500">
                        <span className="material-icons-round text-sm">thumb_up</span>
                    </button>
                    <button className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-300 hover:text-red-500">
                        <span className="material-icons-round text-sm">thumb_down</span>
                    </button>
                </div>
            </div>
        </article>
    );
};