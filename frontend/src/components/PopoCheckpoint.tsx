import React, { useState, useEffect } from 'react';
import { useCourseStore } from '../stores/courseStore';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import clsx from 'clsx';

export const PopoCheckpoint: React.FC = () => {
    const { 
        isCheckpointOpen, 
        checkpointQuestion, 
        checkpointFeedback, 
        closeCheckpoint, 
        verifyCheckpointAnswer,
        toggleModuleComplete,
        checkpointModuleId
    } = useCourseStore();

    const [answer, setAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isCheckpointOpen) {
            setAnswer('');
            setIsSubmitting(false);
        }
    }, [isCheckpointOpen]);

    if (!isCheckpointOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!answer.trim() || isSubmitting) return;

        setIsSubmitting(true);
        await verifyCheckpointAnswer(answer);
        setIsSubmitting(false);
    };

    const handleSkip = () => {
        if (checkpointModuleId) {
            toggleModuleComplete(checkpointModuleId);
        }
        closeCheckpoint();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header/Lottie Area */}
                <div className="relative h-48 bg-orange-50 dark:bg-orange-900/10 flex items-center justify-center border-b border-orange-100/50 dark:border-orange-800/20">
                    <div className="w-48 h-48">
                        <DotLottieReact
                            src="https://lottie.host/073f508e-b3d5-4654-a7bb-b957ca581210/LrYzYyPEiN.lottie"
                            loop
                            autoplay
                        />
                    </div>
                    <button 
                        onClick={closeCheckpoint}
                        className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/50 dark:hover:bg-slate-800/50 text-slate-400 transition-colors"
                    >
                        <span className="material-icons-round">close</span>
                    </button>
                </div>

                <div className="p-8 md:p-10 flex-1 overflow-y-auto">
                    {!checkpointFeedback ? (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <span className="text-primary font-bold text-xs tracking-widest uppercase">Popo Checkpoint</span>
                                <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white leading-tight">
                                    Want to test your understanding before moving on?
                                </h3>
                            </div>

                            {!checkpointQuestion ? (
                                <div className="flex items-center gap-3 text-slate-500 py-4">
                                    <span className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                                    <span>Captain Popo is thinking of a question...</span>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 italic text-slate-700 dark:text-slate-300">
                                        "{checkpointQuestion}"
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <textarea
                                            value={answer}
                                            onChange={(e) => setAnswer(e.target.value)}
                                            placeholder="Type your explanation here..."
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none min-h-[120px] resize-none"
                                            disabled={isSubmitting}
                                        />
                                        <div className="flex gap-3">
                                            <button
                                                type="submit"
                                                disabled={!answer.trim() || isSubmitting}
                                                className="flex-1 bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {isSubmitting ? (
                                                    <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                                ) : (
                                                    <>Check Answer <span className="material-icons-round text-sm">auto_awesome</span></>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSkip}
                                                className="px-6 py-3 border border-slate-200 dark:border-slate-700 text-slate-500 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                Skip
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in zoom-in-95 duration-500">
                            <div className="flex items-center gap-4">
                                <div className={clsx(
                                    "w-12 h-12 rounded-full flex items-center justify-center shadow-sm",
                                    checkpointFeedback.is_correct ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                                )}>
                                    <span className="material-icons-round text-2xl">
                                        {checkpointFeedback.is_correct ? "check_circle" : "lightbulb"}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                                    {checkpointFeedback.is_correct ? "Excellent!" : "Not Quite..."}
                                </h3>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 leading-relaxed">
                                {checkpointFeedback.feedback}
                            </div>

                            <button
                                onClick={closeCheckpoint}
                                className="w-full bg-navy-dark dark:bg-white text-white dark:text-navy-dark py-4 rounded-xl font-bold shadow-xl transition-all hover:opacity-90"
                            >
                                {checkpointFeedback.is_correct ? "Continue to Next Lesson" : "Got it!"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
