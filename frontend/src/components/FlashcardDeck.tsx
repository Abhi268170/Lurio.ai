import React, { useState, useEffect } from 'react';
import { useCourseStore } from '../stores/courseStore';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export const FlashcardDeck: React.FC = () => {
    const {
        isFlashcardDeckOpen,
        toggleFlashcardDeck,
        activeModuleId,
        loadFlashcards,
        flashcards,
        modules
    } = useCourseStore();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Get current module cards
    const currentCards = activeModuleId ? flashcards[activeModuleId] : null;
    const activeModule = modules.find(m => m.id === activeModuleId);

    useEffect(() => {
        if (isFlashcardDeckOpen && activeModuleId && !currentCards) {
            const load = async () => {
                setIsLoading(true);
                await loadFlashcards(activeModuleId);
                setIsLoading(false);
            };
            load();
        }
    }, [isFlashcardDeckOpen, activeModuleId, currentCards, loadFlashcards]);

    if (!isFlashcardDeckOpen) return null;

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentCards && currentIndex < currentCards.length - 1) {
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
        }
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentIndex > 0) {
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(prev => prev - 1), 150);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            Revision Cards
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {activeModule?.title || 'Module Revision'}
                        </p>
                    </div>
                    <button
                        onClick={() => toggleFlashcardDeck(false)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <span className="material-icons-round text-slate-500">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-8 flex flex-col items-center justify-center min-h-[400px] bg-slate-50 dark:bg-slate-950/50">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center text-center">
                            <div className="w-48 h-48 mb-4">
                                <DotLottieReact
                                    src="https://lottie.host/073f508e-b3d5-4654-a7bb-b957ca581210/LrYzYyPEiN.lottie"
                                    loop
                                    autoplay
                                />
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 font-medium">Generating your revision deck...</p>
                            <p className="text-xs text-slate-400 mt-2">Prof. Popo is extracting key concepts</p>
                        </div>
                    ) : currentCards && currentCards.length > 0 ? (
                        <div className="w-full max-w-lg perspective-1000">
                            <div
                                className={`relative w-full aspect-[3/2] cursor-pointer transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
                                onClick={() => setIsFlipped(!isFlipped)}
                            >
                                {/* Front */}
                                <div className="absolute inset-0 backface-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center justify-center text-center">
                                    <span className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Concept</span>
                                    <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                                        {currentCards[currentIndex].front}
                                    </h4>
                                    <p className="absolute bottom-6 text-xs text-slate-400 font-medium animate-pulse">
                                        Click to flip
                                    </p>
                                </div>

                                {/* Back */}
                                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-900 dark:bg-primary text-white rounded-2xl shadow-xl p-8 flex flex-col items-center justify-center text-center">
                                    <span className="text-xs font-bold text-white/70 uppercase tracking-widest mb-4">Definition</span>
                                    <p className="text-lg leading-relaxed font-medium">
                                        {currentCards[currentIndex].back}
                                    </p>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center justify-between mt-8 px-4">
                                <button
                                    onClick={handlePrev}
                                    disabled={currentIndex === 0}
                                    className="p-3 rounded-full hover:bg-white dark:hover:bg-slate-800 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                >
                                    <span className="material-icons-round">arrow_back</span>
                                </button>
                                <span className="text-sm font-bold text-slate-400 tabular-nums">
                                    {currentIndex + 1} / {currentCards.length}
                                </span>
                                <button
                                    onClick={handleNext}
                                    disabled={currentIndex === currentCards.length - 1}
                                    className="p-3 rounded-full hover:bg-white dark:hover:bg-slate-800 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                >
                                    <span className="material-icons-round">arrow_forward</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-slate-500">
                            <p>No flashcards available for this module.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
