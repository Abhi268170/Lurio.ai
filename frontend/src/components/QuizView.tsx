import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { useCourseStore } from '../stores/courseStore';

interface Option {
    text: string;
    isCorrect: boolean;
}

interface Question {
    id: number;
    type: 'single' | 'multiple';
    question: string;
    options: Option[];
    explanation?: string;
}

interface QuizViewProps {
    content: string;
    moduleId: number;
    userData?: string; // Previous answers if any
}

export const QuizView: React.FC<QuizViewProps> = ({ content, moduleId, userData }) => {
    const { submitQuiz } = useCourseStore();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [userAnswers, setUserAnswers] = useState<Record<number, number[]>>({}); // questionId -> indices of selected options
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!content) return; // Don't parse empty content
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                setQuestions(parsed);
            }
        } catch (e) {
            // It's expected to fail while streaming or if empty
            // console.warn("Waiting for valid quiz JSON...", e);
        }
    }, [content]);

    useEffect(() => {
        if (userData) {
            try {
                const parsedAnswers = JSON.parse(userData);
                // Transform stored answers if needed, assumes storing same structure
                // For now, let's assume userData stores the full answer state or we handle it
                // Actually, let's just use it if available to show "Review Mode"
                setSubmitted(true);
                setUserAnswers(parsedAnswers);
            } catch (e) {
                console.error("Failed to parse user data", e);
            }
        }
    }, [userData]);

    const handleOptionClick = (questionId: number, optionIndex: number, type: 'single' | 'multiple') => {
        if (submitted) return; // Read-only if already done

        setUserAnswers(prev => {
            const current = prev[questionId] || [];

            // If already selected, maybe toggle? But regarding "instant feedback", usually you pick and it tells you.
            // If we want "instant feedback", user clicks -> we show result.
            // Should we lock the question after answering? 
            // "once theyve marked their answer theyshould get instant feedback"
            // Let's allow changing for now unless instant feedback reveals the answer fully.
            // If instant feedback shows Red/Green, they know the answer. So effectively one try per question?
            // Let's implement: Select -> Show Color -> Lock that question?
            // Or Select -> Show Color. If wrong (Red), maybe they can try again?
            // Requirement: "answers given by the user will be saved... user will have to complete the test"

            // Implementation:
            // Single choice: Click -> Selects it.
            // Multiple choice: Click -> Toggles it.

            if (type === 'single') {
                return { ...prev, [questionId]: [optionIndex] };
            } else {
                if (current.includes(optionIndex)) {
                    return { ...prev, [questionId]: current.filter(i => i !== optionIndex) };
                } else {
                    return { ...prev, [questionId]: [...current, optionIndex] };
                }
            }
        });
    };

    const isCorrect = (question: Question, selectedIndices: number[]) => {
        if (!selectedIndices || selectedIndices.length === 0) return false;

        if (question.type === 'single') {
            const selected = selectedIndices[0];
            return question.options[selected]?.isCorrect;
        } else {
            // MSQ: All correct options must be selected, and no incorrect ones.
            const correctIndices = question.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
            if (selectedIndices.length !== correctIndices.length) return false;
            return selectedIndices.every(i => correctIndices.includes(i));
        }
    };

    const allAnswered = questions.length > 0 && questions.every(q => userAnswers[q.id] && userAnswers[q.id].length > 0);

    const handleSubmit = async () => {
        await submitQuiz(moduleId, userAnswers as any);
        setSubmitted(true);
    };

    if (questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p>Generating your Final Revision Exam...</p>
                <p className="text-sm opacity-70 mt-2">This usually takes about 10-20 seconds.</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto pb-12">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Final Revision</h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Test your knowledge to complete the course.
                </p>
            </div>

            <div className="space-y-8">
                {questions.map((q, qIdx) => {
                    const selectedIndices = userAnswers[q.id] || [];
                    const isAnswered = selectedIndices.length > 0;

                    return (
                        <div key={q.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex gap-3">
                                <span className="flex-shrink-0 w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-sm font-bold text-slate-500">
                                    {qIdx + 1}
                                </span>
                                <div>
                                    <div className="mb-1">
                                        {q.type === 'single' ? (
                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                                Single Choice
                                            </span>
                                        ) : (
                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                                                Select All That Apply
                                            </span>
                                        )}
                                    </div>
                                    {q.question}
                                </div>
                            </h3>

                            <div className="grid gap-3">
                                {q.options.map((opt, oIdx) => {
                                    const isSelected = selectedIndices.includes(oIdx);

                                    // Feedback Logic
                                    // if isSelected:
                                    //    if opt.isCorrect -> Green
                                    //    else -> Red
                                    // if submitted (review mode) and opt.isCorrect -> Green (show correct answer)

                                    let borderColor = "border-slate-200 dark:border-slate-700";
                                    let bgColor = "hover:bg-slate-50 dark:hover:bg-slate-800";
                                    let icon = null;

                                    if (isSelected) {
                                        if (opt.isCorrect) {
                                            borderColor = "border-green-500 bg-green-50 dark:bg-green-900/20";
                                            bgColor = "";
                                            icon = <span className="material-icons-round text-green-500">check_circle</span>;
                                        } else {
                                            borderColor = "border-red-500 bg-red-50 dark:bg-red-900/20";
                                            bgColor = "";
                                            icon = <span className="material-icons-round text-red-500">cancel</span>;
                                        }
                                    } else if (submitted && opt.isCorrect) {
                                        // Show correct answer if submitted
                                        borderColor = "border-green-500 border-dashed";
                                    }

                                    return (
                                        <div
                                            key={oIdx}
                                            onClick={() => handleOptionClick(q.id, oIdx, q.type)}
                                            className={clsx(
                                                "relative flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all duration-200",
                                                borderColor,
                                                !isSelected && !submitted && bgColor,
                                                submitted && "cursor-default"
                                            )}
                                        >
                                            <span className={clsx(
                                                "font-medium",
                                                isSelected ? (opt.isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400") : "text-slate-700 dark:text-slate-300"
                                            )}>
                                                {opt.text}
                                            </span>
                                            {icon}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Explanation (User asked for feedback, maybe explanation helps) */}
                            {isAnswered && (
                                <div className={clsx(
                                    "mt-4 p-4 rounded-lg text-sm",
                                    "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                )}>
                                    <strong>Feedback: </strong> {q.explanation || (isCorrect(q, selectedIndices) ? "Correct!" : "Incorrect.")}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-12 flex justify-center">
                {!submitted ? (
                    <button
                        onClick={handleSubmit}
                        disabled={!allAnswered}
                        className={clsx(
                            "px-8 py-4 rounded-xl font-bold text-lg shadow-xl transition-all",
                            allAnswered
                                ? "bg-primary text-white hover:opacity-90 hover:scale-105 shadow-primary/30"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800"
                        )}
                    >
                        Complete Course
                    </button>
                ) : (
                    <div className="text-center p-6 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-xl border border-green-200 dark:border-green-800">
                        <h3 className="text-xl font-bold mb-2">Course Completed!</h3>
                        <p>Great job! You have mastered this topic.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
