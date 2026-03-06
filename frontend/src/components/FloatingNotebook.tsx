import React, { useState, useRef, useEffect } from 'react';
import { useCourseStore } from '../stores/courseStore';
import clsx from 'clsx';

interface FloatingNotebookProps {
    isOpen: boolean;
    onClose: () => void;
    initialModuleId: number | null;
}

export const FloatingNotebook: React.FC<FloatingNotebookProps> = ({ isOpen, onClose, initialModuleId }) => {
    const { modules, moduleNotes, saveNotes } = useCourseStore();

    const [activeTab, setActiveTab] = useState<number | null>(initialModuleId);
    // localNotes holds unsaved edits per module; initialized from store on first access
    const [localNotes, setLocalNotes] = useState<Record<number, string>>({});
    const [savedTabs, setSavedTabs] = useState<Record<number, boolean>>({});
    const [position, setPosition] = useState({ x: Math.max(window.innerWidth - 480, 20), y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const initialized = useRef<Set<number>>(new Set());

    // Initialize localNotes from store for any module not yet touched
    useEffect(() => {
        setLocalNotes(prev => {
            const next = { ...prev };
            modules.forEach(m => {
                if (!initialized.current.has(m.id)) {
                    next[m.id] = moduleNotes[m.id] || '';
                    initialized.current.add(m.id);
                }
            });
            return next;
        });
    }, [modules, moduleNotes]);

    // Track active module externally
    useEffect(() => {
        if (initialModuleId !== null) setActiveTab(initialModuleId);
    }, [initialModuleId]);

    // Drag logic
    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e: MouseEvent) => {
            setPosition({
                x: Math.max(0, Math.min(window.innerWidth - 440, e.clientX - dragOffset.current.x)),
                y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y)),
            });
        };
        const onUp = () => setIsDragging(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [isDragging]);

    const handleDragStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleSave = async (moduleId: number) => {
        await saveNotes(moduleId, localNotes[moduleId] || '');
        setSavedTabs(prev => ({ ...prev, [moduleId]: true }));
        setTimeout(() => setSavedTabs(prev => ({ ...prev, [moduleId]: false })), 2000);
    };

    const lessonModules = modules.filter(m => m.module_type !== 'quiz');

    if (!isOpen) return null;

    return (
        <div
            className="fixed z-50 w-[440px] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            style={{ left: position.x, top: position.y, maxHeight: '72vh' }}
        >
            {/* Drag handle / header */}
            <div
                className="flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
                onMouseDown={handleDragStart}
            >
                <div className="flex items-center gap-2">
                    <span className="material-icons-round text-amber-500 text-sm">menu_book</span>
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-400">My Notebook</span>
                    <span className="text-xs text-amber-400 dark:text-amber-600 font-normal">— per module notes</span>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30"
                    onMouseDown={e => e.stopPropagation()}
                >
                    <span className="material-icons-round text-sm">close</span>
                </button>
            </div>

            {/* Module tabs */}
            <div className="flex overflow-x-auto border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0 scrollbar-hide">
                {lessonModules.map((m, i) => {
                    const hasNote = !!(moduleNotes[m.id] || localNotes[m.id]);
                    const isDirty = (localNotes[m.id] || '') !== (moduleNotes[m.id] || '');
                    return (
                        <button
                            key={m.id}
                            onClick={() => setActiveTab(m.id)}
                            className={clsx(
                                'relative flex-shrink-0 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors text-left max-w-[130px]',
                                activeTab === m.id
                                    ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900'
                                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800'
                            )}
                        >
                            <span className="text-[10px] text-slate-400 block leading-none mb-0.5">Module {i + 1}</span>
                            <span className="block truncate leading-snug">{m.title}</span>
                            {/* Dot indicators */}
                            {(hasNote || isDirty) && (
                                <span className={clsx(
                                    'absolute top-2 right-2 w-1.5 h-1.5 rounded-full',
                                    isDirty ? 'bg-amber-400' : 'bg-green-400'
                                )} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Note editor */}
            {activeTab !== null ? (
                <div className="flex flex-col flex-1 p-4 overflow-hidden min-h-0">
                    <div className="flex items-center justify-between mb-3 flex-shrink-0">
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                            Unsaved
                            <span className="mx-1 text-slate-200 dark:text-slate-700">·</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                            Saved
                        </span>
                        <button
                            onClick={() => handleSave(activeTab)}
                            className={clsx(
                                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1',
                                savedTabs[activeTab]
                                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-amber-600 text-white hover:bg-amber-700'
                            )}
                        >
                            <span className="material-icons-round text-sm">{savedTabs[activeTab] ? 'check' : 'save'}</span>
                            {savedTabs[activeTab] ? 'Saved!' : 'Save Note'}
                        </button>
                    </div>
                    <textarea
                        value={localNotes[activeTab] ?? ''}
                        onChange={e => setLocalNotes(prev => ({ ...prev, [activeTab]: e.target.value }))}
                        placeholder="Write your notes for this module here..."
                        className="flex-1 w-full bg-amber-50/60 dark:bg-slate-800 rounded-xl border border-amber-100 dark:border-slate-700 px-3 py-3 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[200px]"
                    />
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm p-8">
                    Select a module tab above to start taking notes.
                </div>
            )}
        </div>
    );
};
