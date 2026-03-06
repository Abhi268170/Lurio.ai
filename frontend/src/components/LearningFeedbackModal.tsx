import React, { useState } from 'react';
import clsx from 'clsx';
import { useAuthStore } from '../stores/useAuthStore';

interface Props {
    onClose: () => void;
}

const PACE_OPTIONS = [
    { value: 'simple', label: 'Too simple', desc: 'Keep it concise' },
    { value: 'balanced', label: 'Just right', desc: 'Good depth' },
    { value: 'dense', label: 'Too dense', desc: 'More detail please' },
];

const BACKGROUND_OPTIONS = [
    { value: 'none', label: 'New to it', desc: 'First time learning this' },
    { value: 'some', label: 'Some exposure', desc: "I've seen this before" },
    { value: 'working', label: 'I use it', desc: 'Work with it regularly' },
];

const GOAL_OPTIONS = [
    { value: 'curiosity', label: 'Curiosity', icon: 'lightbulb' },
    { value: 'career', label: 'Career / Work', icon: 'work' },
    { value: 'academic', label: 'Academic study', icon: 'school' },
    { value: 'interview', label: 'Interview prep', icon: 'quiz' },
];

export const LearningFeedbackModal: React.FC<Props> = ({ onClose }) => {
    const [pace, setPace] = useState<string | null>(null);
    const [background, setBackground] = useState<string | null>(null);
    const [goal, setGoal] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!pace || !background || !goal) return;
        setSaving(true);
        try {
            const token = useAuthStore.getState().token;
            await fetch('http://localhost:8000/api/v1/profile/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    content_pace_preference: pace,
                    background_level: background,
                    primary_goal: goal,
                }),
            });
        } catch {
            // non-blocking — don't fail the user experience
        } finally {
            setSaving(false);
            onClose();
        }
    };

    const handleSkip = async () => {
        // Mark as shown so it doesn't appear again
        try {
            const token = useAuthStore.getState().token;
            await fetch('http://localhost:8000/api/v1/profile/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    content_pace_preference: 'balanced',
                    background_level: 'some',
                    primary_goal: 'curiosity',
                }),
            });
        } catch { /* ignore */ }
        onClose();
    };

    const canSubmit = pace && background && goal;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-2xl">🎉</span>
                        <h2 className="font-display font-bold text-xl text-slate-800 dark:text-white">
                            You finished your first module!
                        </h2>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Help Lurio teach you better — takes 30 seconds.
                    </p>
                </div>

                <div className="px-6 py-5 space-y-6">
                    {/* Q1: Pace */}
                    <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                            How did that explanation feel?
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {PACE_OPTIONS.map(o => (
                                <button
                                    key={o.value}
                                    onClick={() => setPace(o.value)}
                                    className={clsx(
                                        'p-3 rounded-xl border-2 text-left transition-all',
                                        pace === o.value
                                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                    )}
                                >
                                    <div className="font-semibold text-sm text-slate-800 dark:text-white">{o.label}</div>
                                    <div className="text-xs text-slate-400 mt-0.5">{o.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Q2: Background */}
                    <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                            Your background with this topic?
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {BACKGROUND_OPTIONS.map(o => (
                                <button
                                    key={o.value}
                                    onClick={() => setBackground(o.value)}
                                    className={clsx(
                                        'p-3 rounded-xl border-2 text-left transition-all',
                                        background === o.value
                                            ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-teal-400/50'
                                    )}
                                >
                                    <div className="font-semibold text-sm text-slate-800 dark:text-white">{o.label}</div>
                                    <div className="text-xs text-slate-400 mt-0.5">{o.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Q3: Goal */}
                    <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                            What are you learning this for?
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {GOAL_OPTIONS.map(o => (
                                <button
                                    key={o.value}
                                    onClick={() => setGoal(o.value)}
                                    className={clsx(
                                        'p-3 rounded-xl border-2 flex items-center gap-3 transition-all',
                                        goal === o.value
                                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-violet-400/50'
                                    )}
                                >
                                    <span className="material-icons-round text-slate-400 text-xl">{o.icon}</span>
                                    <span className="font-semibold text-sm text-slate-800 dark:text-white">{o.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex items-center justify-between">
                    <button
                        onClick={handleSkip}
                        className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                        Skip for now
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit || saving}
                        className={clsx(
                            'px-6 py-2.5 rounded-xl font-semibold text-sm transition-all',
                            canSubmit
                                ? 'bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20'
                                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                        )}
                    >
                        {saving ? 'Saving...' : 'Save & Continue'}
                    </button>
                </div>
            </div>
        </div>
    );
};
