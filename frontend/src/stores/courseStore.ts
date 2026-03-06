import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';

export interface Module {
    id: number;
    title: string;
    status: 'pending' | 'generating' | 'completed' | 'failed';
    is_completed_by_user: boolean;
    module_type: 'lesson' | 'quiz';
    user_data?: string;
    notes?: string | null;
    audio_status?: string | null;
}

interface CourseStore {
    courseId: number | null;
    journeyId: number | null;
    title: string;
    topic: string;
    provider: string;
    model: string | null;
    courseStatus: 'pending' | 'generating' | 'completed' | 'failed';
    podcastStatus: string | null; // null, 'generating', 'completed', 'failed'
    modules: Module[];
    activeModuleId: number | null;
    moduleContent: Record<number, string>; // Map module_id -> markdown content

    // Chat state
    chatInitialText: string | null;
    isChatOpen: boolean;

    // Flashcards state
    flashcards: Record<number, any[]>; // module_id -> flashcards map
    isFlashcardDeckOpen: boolean;

    // Popo Checkpoint state
    isCheckpointOpen: boolean;
    checkpointModuleId: number | null;
    checkpointQuestion: string | null;
    checkpointFeedback: { is_correct: boolean; feedback: string } | null;

    // Pappy Chat (Feynman Technique) state
    isPappyChatOpen: boolean;
    pappyMessages: { role: 'user' | 'assistant'; content: string }[];
    isPappyLoading: boolean;

    // Actions
    setCourse: (id: number, title: string, topic: string, provider?: string, journeyId?: number | null, model?: string | null) => void;
    setCourseStatus: (status: 'pending' | 'generating' | 'completed' | 'failed') => void;
    setModules: (modules: Module[]) => void;
    updateModuleStatus: (id: number, status: Module['status']) => void;
    appendToModuleContent: (id: number, chunk: string) => void;
    setModuleContent: (id: number, content: string) => void;
    setActiveModule: (id: number) => void;

    // Chat Actions
    toggleChat: (isOpen?: boolean) => void;
    openChatWithText: (text: string) => void;

    // Flashcard Actions
    loadFlashcards: (moduleId: number) => Promise<void>;
    toggleFlashcardDeck: (isOpen?: boolean) => void;

    // Popo Checkpoint Actions
    openCheckpoint: (moduleId: number) => Promise<void>;
    closeCheckpoint: () => void;
    verifyCheckpointAnswer: (answer: string) => Promise<void>;

    // Pappy Actions
    togglePappyChat: (isOpen?: boolean) => void;
    sendPappyMessage: (content: string) => Promise<void>;
    resetPappyChat: () => void;

    // User Progress Actions
    toggleModuleComplete: (moduleId: number) => Promise<void>;
    submitQuiz: (moduleId: number, answers: any[]) => Promise<void>;
    generateFinalRevision: () => Promise<void>;
    fetchPodcastStatus: () => Promise<void>;

    // Podcast Actions
    setPodcastStatus: (status: string | null) => void;
    generatePodcast: () => Promise<void>;

    // Notes Actions
    moduleNotes: Record<number, string>;
    saveNotes: (moduleId: number, notes: string) => Promise<void>;

    // Audio Actions
    moduleAudioStatus: Record<number, string | null>;
    setModuleAudioStatus: (moduleId: number, status: string | null) => void;
    generateModuleAudio: (moduleId: number) => Promise<void>;
    fetchModuleAudioUrl: (moduleId: number) => Promise<string | null>;

    // Regenerate Actions
    regenerateModule: (moduleId: number, difficulty: string) => Promise<void>;

    // Mindmap
    fetchMindmap: () => Promise<any | null>;

    // Analytics & Personalization
    moduleOpenedAt: Record<number, number>; // moduleId -> Date.now()
    showFeedbackForm: boolean;
    setShowFeedbackForm: (v: boolean) => void;
    trackModuleOpen: (moduleId: number) => void;
    trackModuleComplete: (moduleId: number) => Promise<void>;
    trackFeatureUsage: (feature: string) => void;
}

export const useCourseStore = create<CourseStore>((set, get) => ({
    courseId: null,
    journeyId: null,
    title: '',
    topic: '',
    provider: 'ollama',
    model: null,
    courseStatus: 'pending',
    podcastStatus: null,
    modules: [],
    activeModuleId: null,
    moduleContent: {},
    chatInitialText: null,
    isChatOpen: false,

    // Flashcards
    flashcards: {},
    isFlashcardDeckOpen: false,

    // Popo Checkpoint
    isCheckpointOpen: false,
    checkpointModuleId: null,
    checkpointQuestion: null,
    checkpointFeedback: null,

    // Pappy Chat
    isPappyChatOpen: false,
    pappyMessages: [],
    isPappyLoading: false,

    // Notes & Audio
    moduleNotes: {},
    moduleAudioStatus: {},

    // Analytics
    moduleOpenedAt: {},
    showFeedbackForm: false,

    setCourse: (id: number, title: string, topic: string, provider?: string, journeyId?: number | null, model?: string | null) =>
        set((state) => ({
            courseId: id,
            title,
            topic: topic || state.topic,
            provider: provider || state.provider,
            journeyId: journeyId !== undefined ? journeyId : state.journeyId,
            model: model !== undefined ? model : state.model,
            podcastStatus: state.courseId !== id ? null : state.podcastStatus,
        })),
    setCourseStatus: (status: 'pending' | 'generating' | 'completed' | 'failed') => set({ courseStatus: status }),
    setModules: (modules: Module[]) => {
        const newNotes: Record<number, string> = {};
        const newAudioStatus: Record<number, string | null> = {};
        const normalized = modules.map(m => ({
            ...m,
            status: (m.status?.toLowerCase() ?? m.status) as Module['status'],
        }));
        normalized.forEach(m => {
            if (m.notes) newNotes[m.id] = m.notes;
            if (m.audio_status) newAudioStatus[m.id] = m.audio_status;
        });
        set(state => ({
            modules: normalized,
            moduleNotes: { ...state.moduleNotes, ...newNotes },
            moduleAudioStatus: { ...state.moduleAudioStatus, ...newAudioStatus },
        }));
    },

    updateModuleStatus: (id: number, status: Module['status']) => set((state) => ({
        modules: state.modules.map(m => m.id === id ? { ...m, status } : m)
    })),

    appendToModuleContent: (id: number, chunk: string) => set((state) => ({
        moduleContent: {
            ...state.moduleContent,
            [id]: (state.moduleContent[id] || '') + chunk
        }
    })),

    setModuleContent: (id: number, content: string) => set((state) => ({
        moduleContent: {
            ...state.moduleContent,
            [id]: content
        }
    })),

    setActiveModule: (id: number) => {
        set({ activeModuleId: id });
        get().trackModuleOpen(id);
    },

    toggleChat: (isOpen?: boolean) => set((state) => ({
        isChatOpen: isOpen !== undefined ? isOpen : !state.isChatOpen
    })),

    openChatWithText: (text: string) => set({
        isChatOpen: true,
        chatInitialText: text
    }),

    loadFlashcards: async (moduleId: number) => {
        try {
            // Use current courseId from state
            const courseId = get().courseId;
            if (!courseId) return;

            const token = useAuthStore.getState().token;
            const response = await fetch(`http://localhost:8000/api/v1/courses/${courseId}/modules/${moduleId}/flashcards`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            if (response.ok) {
                const data = await response.json();
                set((state) => ({
                    flashcards: { ...state.flashcards, [moduleId]: data }
                }));
            }
        } catch (error) {
            console.error("Failed to load flashcards", error);
        }
    },

    toggleFlashcardDeck: (isOpen?: boolean) => set((state) => ({
        isFlashcardDeckOpen: isOpen !== undefined ? isOpen : !state.isFlashcardDeckOpen
    })),

    openCheckpoint: async (moduleId: number) => {
        const courseId = get().courseId;
        if (!courseId) return;

        set({ isCheckpointOpen: true, checkpointModuleId: moduleId, checkpointQuestion: null, checkpointFeedback: null });

        try {
            const token = useAuthStore.getState().token;
            const response = await fetch(`http://localhost:8000/api/v1/courses/${courseId}/modules/${moduleId}/recall-question`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            if (response.ok) {
                const data = await response.json();
                set({ checkpointQuestion: data.question });
            }
        } catch (error) {
            console.error("Failed to fetch checkpoint question", error);
        }
    },

    closeCheckpoint: () => set({ isCheckpointOpen: false, checkpointModuleId: null, checkpointQuestion: null, checkpointFeedback: null }),

    verifyCheckpointAnswer: async (answer: string) => {
        const { courseId, checkpointModuleId, checkpointQuestion } = get();
        if (!courseId || !checkpointModuleId || !checkpointQuestion) return;

        try {
            const token = useAuthStore.getState().token;
            const response = await fetch(`http://localhost:8000/api/v1/courses/${courseId}/modules/${checkpointModuleId}/verify-recall`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ question: checkpointQuestion, answer })
            });

            if (response.ok) {
                const data = await response.json();
                set({ checkpointFeedback: data });

                // If they finished the checkpoint, we can optimistically mark the module complete if we want, 
                // but the user should still have the choice. 
                // The prompt says "automatically marks the module as complete" after feedback.
                if (data.is_correct) {
                    await get().toggleModuleComplete(checkpointModuleId);
                }
            }
        } catch (error) {
            console.error("Failed to verify checkpoint answer", error);
        }
    },

    togglePappyChat: (isOpen?: boolean) => set((state) => {
        const nextOpen = isOpen !== undefined ? isOpen : !state.isPappyChatOpen;

        // If opening for the first time in this module, add initial message
        if (nextOpen && state.pappyMessages.length === 0) {
            const activeModule = state.modules.find(m => m.id === state.activeModuleId);
            const initialMessage = {
                role: 'assistant' as const,
                content: `Hi! I'm really curious about this module, ${activeModule?.title || 'this lesson'}, but I'm having a hard time understanding the basics. What exactly are we going to learn here? Can you break it down for me?`
            };
            return { isPappyChatOpen: nextOpen, pappyMessages: [initialMessage] };
        }

        return { isPappyChatOpen: nextOpen };
    }),

    resetPappyChat: () => set({ pappyMessages: [], isPappyLoading: false }),

    sendPappyMessage: async (content: string) => {
        const { topic, activeModuleId, modules, moduleContent, pappyMessages, provider, model } = get();
        const activeModule = modules.find(m => m.id === activeModuleId);
        if (!activeModule || !activeModuleId) return;

        const userMessage = { role: 'user' as const, content };
        const updatedMessages = [...pappyMessages, userMessage];

        set({ pappyMessages: updatedMessages, isPappyLoading: true });

        try {
            const token = useAuthStore.getState().token;
            const apiKey = localStorage.getItem(`lurio_key_${provider}`);
            console.log("DEBUG: token exists:", !!token);
            const response = await fetch('http://localhost:8000/api/v1/pappy/chat/stream', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    topic,
                    module_title: activeModule.title,
                    module_content: moduleContent[activeModuleId] || "",
                    history: updatedMessages,
                    provider,
                    model,
                    api_key: apiKey
                })
            });

            if (!response.ok) throw new Error("Pappy is having trouble listening.");

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = '';

            // Add empty assistant message
            set(state => ({
                pappyMessages: [...state.pappyMessages, { role: 'assistant', content: '' }]
            }));

            while (reader) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        if (data.chunk) {
                            accumulatedText += data.chunk;
                            set(state => {
                                const newMessages = [...state.pappyMessages];
                                newMessages[newMessages.length - 1].content = accumulatedText;
                                return { pappyMessages: newMessages };
                            });
                        }
                        if (data.error) throw new Error(data.error);
                    }
                }
            }
        } catch (error) {
            console.error("Pappy error:", error);
            set(state => ({
                pappyMessages: [...state.pappyMessages, { role: 'assistant', content: "Sorry, I got a bit confused there. Can you say that again?" }]
            }));
        } finally {
            set({ isPappyLoading: false });
        }
    },

    toggleModuleComplete: async (moduleId: number) => {
        try {
            const courseId = get().courseId;
            if (!courseId) return;

            const token = useAuthStore.getState().token;
            const response = await fetch(`http://localhost:8000/api/v1/courses/${courseId}/modules/${moduleId}/toggle-complete`, {
                method: 'PATCH',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });

            if (response.ok) {
                const updatedModule = await response.json();
                set((state) => ({
                    modules: state.modules.map(m =>
                        m.id === moduleId ? { ...m, is_completed_by_user: updatedModule.is_completed_by_user } : m
                    )
                }));
                // Track completion analytics (only when marking as complete, not uncomplete)
                if (updatedModule.is_completed_by_user) {
                    await get().trackModuleComplete(moduleId);
                }
            }
        } catch (error) {
            console.error("Failed to toggle module completion", error);
        }
    },

    submitQuiz: async (moduleId: number, answers: any[]) => {
        try {
            const courseId = get().courseId;
            if (!courseId) return;

            const token = useAuthStore.getState().token;
            const response = await fetch(`http://localhost:8000/api/v1/courses/${courseId}/modules/${moduleId}/submit-quiz`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ answers })
            });

            if (response.ok) {
                const updatedModule = await response.json();
                set((state) => ({
                    modules: state.modules.map(m =>
                        m.id === moduleId ? updatedModule : m
                    ),
                    courseStatus: 'completed' // Optimistically mark course as complete
                }));
            }
        } catch (error) {
            console.error("Failed to submit quiz", error);
        }
    },

    generateFinalRevision: async () => {
        // ... (existing code unchanged in previous turns)
    },

    fetchPodcastStatus: async () => {
        const { courseId } = get();
        if (!courseId) return;
        try {
            const token = useAuthStore.getState().token;
            const response = await fetch(`http://localhost:8000/api/v1/courses/${courseId}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            if (response.ok) {
                const data = await response.json();
                if (data.podcast_status) {
                    set({ podcastStatus: data.podcast_status });
                }
            }
        } catch (e) {
            console.error("Failed to fetch podcast status", e);
        }
    },

    // Podcast
    setPodcastStatus: (status: string | null) => set({ podcastStatus: status }),

    generatePodcast: async () => {
        try {
            const courseId = get().courseId;
            if (!courseId) return;

            set({ podcastStatus: 'generating' });

            const token = useAuthStore.getState().token;
            const response = await fetch(`http://localhost:8000/api/v1/courses/${courseId}/podcast`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'completed') {
                    set({ podcastStatus: 'completed' });
                }
            } else {
                set({ podcastStatus: 'failed' });
            }
        } catch (error) {
            console.error("Failed to generate podcast", error);
            set({ podcastStatus: 'failed' });
        }
    },

    saveNotes: async (moduleId: number, notes: string) => {
        const courseId = get().courseId;
        if (!courseId) return;
        try {
            const token = useAuthStore.getState().token;
            await fetch(`http://localhost:8000/api/v1/courses/${courseId}/modules/${moduleId}/notes`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: JSON.stringify({ notes }),
            });
            set(state => ({ moduleNotes: { ...state.moduleNotes, [moduleId]: notes } }));
        } catch (e) {
            console.error("Failed to save notes", e);
        }
    },

    setModuleAudioStatus: (moduleId: number, status: string | null) =>
        set(state => ({ moduleAudioStatus: { ...state.moduleAudioStatus, [moduleId]: status } })),

    generateModuleAudio: async (moduleId: number) => {
        const courseId = get().courseId;
        if (!courseId) return;
        set(state => ({ moduleAudioStatus: { ...state.moduleAudioStatus, [moduleId]: 'generating' } }));
        try {
            const token = useAuthStore.getState().token;
            await fetch(`http://localhost:8000/api/v1/courses/${courseId}/modules/${moduleId}/audio`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            // Poll for completion every 15s (audio typically takes 30-60s)
            const poll = async (retries = 8) => {
                if (retries <= 0) return;
                await new Promise(r => setTimeout(r, 15000));
                // Re-read token in case it refreshed
                const freshToken = useAuthStore.getState().token;
                try {
                    const resp = await fetch(`http://localhost:8000/api/v1/courses/${courseId}/modules`, {
                        headers: freshToken ? { 'Authorization': `Bearer ${freshToken}` } : {},
                    });
                    if (resp.ok) {
                        const mods = await resp.json();
                        const m = mods.find((x: any) => x.id === moduleId);
                        if (m?.audio_status === 'completed' || m?.audio_status === 'failed') {
                            set(state => ({ moduleAudioStatus: { ...state.moduleAudioStatus, [moduleId]: m.audio_status } }));
                            return; // done
                        }
                    }
                    poll(retries - 1); // retry whether resp ok or not
                } catch { poll(retries - 1); }
            };
            poll();
        } catch (e) {
            console.error("Failed to trigger module audio", e);
            set(state => ({ moduleAudioStatus: { ...state.moduleAudioStatus, [moduleId]: 'failed' } }));
        }
    },

    fetchModuleAudioUrl: async (moduleId: number) => {
        const courseId = get().courseId;
        if (!courseId) return null;
        try {
            const token = useAuthStore.getState().token;
            const response = await fetch(`http://localhost:8000/api/v1/courses/${courseId}/modules/${moduleId}/audio`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            if (!response.ok) return null;
            const blob = await response.blob();
            set(state => ({ moduleAudioStatus: { ...state.moduleAudioStatus, [moduleId]: 'completed' } }));
            return URL.createObjectURL(blob);
        } catch (e) {
            console.error("Failed to fetch module audio", e);
            return null;
        }
    },

    regenerateModule: async (moduleId: number, difficulty: string) => {
        const courseId = get().courseId;
        if (!courseId) return;

        // Optimistically clear content and mark as generating
        set(state => ({
            modules: state.modules.map(m => m.id === moduleId ? { ...m, status: 'generating' } : m),
            moduleContent: { ...state.moduleContent, [moduleId]: '' },
            moduleAudioStatus: { ...state.moduleAudioStatus, [moduleId]: null },
        }));

        try {
            const token = useAuthStore.getState().token;
            const response = await fetch(
                `http://localhost:8000/api/v1/courses/${courseId}/modules/${moduleId}/regenerate`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                    body: JSON.stringify({ difficulty }),
                }
            );

            if (!response.ok || !response.body) {
                set(state => ({ modules: state.modules.map(m => m.id === moduleId ? { ...m, status: 'failed' } : m) }));
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                for (const line of text.split('\n')) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.chunk) {
                            set(state => ({
                                moduleContent: { ...state.moduleContent, [moduleId]: (state.moduleContent[moduleId] || '') + data.chunk }
                            }));
                        }
                        if (data.done) {
                            set(state => ({ modules: state.modules.map(m => m.id === moduleId ? { ...m, status: 'completed' } : m) }));
                        }
                        if (data.error) {
                            set(state => ({ modules: state.modules.map(m => m.id === moduleId ? { ...m, status: 'failed' } : m) }));
                        }
                    } catch { /* skip malformed line */ }
                }
            }
        } catch (e) {
            console.error("Failed to regenerate module", e);
            set(state => ({ modules: state.modules.map(m => m.id === moduleId ? { ...m, status: 'failed' } : m) }));
        }
    },

    setShowFeedbackForm: (v: boolean) => set({ showFeedbackForm: v }),

    trackModuleOpen: (moduleId: number) => {
        set(state => ({
            moduleOpenedAt: { ...state.moduleOpenedAt, [moduleId]: Date.now() }
        }));
        // Fire-and-forget to backend
        const courseId = get().courseId;
        if (!courseId) return;
        const token = useAuthStore.getState().token;
        fetch(`http://localhost:8000/api/v1/courses/${courseId}/modules/${moduleId}/analytics/open`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).catch(() => {});
    },

    trackModuleComplete: async (moduleId: number) => {
        const courseId = get().courseId;
        if (!courseId) return;
        const openedAt = get().moduleOpenedAt[moduleId];
        const timeSpent = openedAt ? Math.round((Date.now() - openedAt) / 1000) : 0;
        try {
            const token = useAuthStore.getState().token;
            const res = await fetch(
                `http://localhost:8000/api/v1/courses/${courseId}/modules/${moduleId}/analytics/complete`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                    body: JSON.stringify({ time_spent_seconds: timeSpent }),
                }
            );
            if (res.ok) {
                const data = await res.json();
                // Show feedback form on the very first ever module completion
                if (data.total_modules_completed === 1) {
                    set({ showFeedbackForm: true });
                }
            }
        } catch { /* non-blocking */ }
    },

    trackFeatureUsage: (feature: string) => {
        const token = useAuthStore.getState().token;
        fetch('http://localhost:8000/api/v1/profile/feature-usage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ feature }),
        }).catch(() => {});
    },

    fetchMindmap: async () => {
        const courseId = get().courseId;
        if (!courseId) return null;
        try {
            const token = useAuthStore.getState().token;
            const response = await fetch(`http://localhost:8000/api/v1/courses/${courseId}/mindmap`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            if (response.ok) return await response.json();
            return null;
        } catch (e) {
            console.error("Failed to fetch mindmap", e);
            return null;
        }
    },
}));
