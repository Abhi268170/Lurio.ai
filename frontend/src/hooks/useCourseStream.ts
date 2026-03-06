import { useEffect, useRef } from 'react';
import { useCourseStore } from '../stores/courseStore';

export const useCourseStream = (courseId: string | undefined) => {
    const ws = useRef<WebSocket | null>(null);
    const {
        setCourse,
        setModules,
        updateModuleStatus,
        appendToModuleContent,
        setModuleContent
    } = useCourseStore();

    useEffect(() => {
        if (!courseId) return;

        // Fetch initial data
        const fetchInitialData = async () => {
            try {
                // Get auth token from store
                const { useAuthStore } = await import('../stores/useAuthStore');
                const token = useAuthStore.getState().token;
                const authHeader: Record<string, string> = token
                    ? { 'Authorization': `Bearer ${token}` }
                    : {};

                // Fetch Course Info
                const courseRes = await fetch(`http://localhost:8000/api/v1/courses/${courseId}`, {
                    headers: authHeader,
                });
                if (courseRes.ok) {
                    const courseData = await courseRes.json();
                    setCourse(courseData.id, courseData.title, courseData.topic, courseData.provider, courseData.journey_id, courseData.model);
                    // Update global course status if available
                    if (courseData.status) {
                        useCourseStore.getState().setCourseStatus(courseData.status);
                    }
                    if (courseData.podcast_status) {
                        useCourseStore.getState().setPodcastStatus(courseData.podcast_status);
                    }
                }

                // Fetch Modules
                const modulesRes = await fetch(`http://localhost:8000/api/v1/courses/${courseId}/modules`, {
                    headers: authHeader,
                });
                if (modulesRes.ok) {
                    const modulesData = await modulesRes.json();
                    console.log("DEBUG: modulesData", modulesData);
                    setModules(modulesData);

                    // Populate content map
                    modulesData.forEach((mod: any) => {
                        if (mod.content) {
                            setModuleContent(mod.id, mod.content);
                        }
                    });

                    // Set active module if not set and we have modules
                    const currentActive = useCourseStore.getState().activeModuleId;
                    if (!currentActive && modulesData.length > 0) {
                        useCourseStore.getState().setActiveModule(modulesData[0].id);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch initial course data", error);
            }
        };

        fetchInitialData();

        // Connect to WebSocket
        // TODO: Make base URL configurable
        ws.current = new WebSocket(`ws://localhost:8000/ws/courses/${courseId}`);

        // Set up periodic fallback polling for podcast status specifically
        const pollingInterval = setInterval(() => {
            const store = useCourseStore.getState();
            if (store.podcastStatus === 'generating') {
                store.fetchPodcastStatus();
            }
        }, 5000);

        ws.current.onopen = () => {
            console.log('Connected to course stream');
        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const store = useCourseStore.getState();

                switch (data.type) {
                    case 'status_update':
                        if (data.course_status) {
                            store.setCourseStatus(data.course_status.toLowerCase());
                        }
                        if (data.podcast_status) {
                            store.setPodcastStatus(data.podcast_status);
                        }
                        if (data.modules && data.modules.length > 0) {
                            const initializedModules = data.modules.map((m: any) => ({
                                is_completed_by_user: false,
                                module_type: 'lesson',
                                ...m
                            }));
                            setModules(initializedModules);

                            // Initialize new active module safely
                            const currentActive = store.activeModuleId;
                            if (!currentActive) {
                                store.setActiveModule(initializedModules[0].id);
                            }

                            // Load all newly fetched content drops 
                            data.modules.forEach((mod: any) => {
                                if (mod.content) {
                                    setModuleContent(mod.id, mod.content);
                                }
                            });
                        }
                        break;

                    case 'syllabus':
                        setCourse(data.course_id, data.title, '', data.provider, undefined, data.model);
                        // Merge new modules with existing to preserve local state if any, 
                        // but usually syllabus is the source of truth for the list.
                        // We map to ensure they have the required fields.
                        const initializedModulesSyllabus = data.modules.map((m: any) => ({
                            is_completed_by_user: false,
                            module_type: 'lesson',
                            ...m
                        }));
                        setModules(initializedModulesSyllabus);
                        break;

                    case 'module_start':
                        updateModuleStatus(data.module_id, 'generating');
                        break;

                    case 'content_chunk':
                        appendToModuleContent(data.module_id, data.chunk);
                        break;

                    case 'module_complete':
                        updateModuleStatus(data.module_id, 'completed');
                        break;

                    case 'course_complete':
                        console.log('Course generation complete');
                        store.setCourseStatus('completed');
                        break;

                    case 'error':
                        console.error('Stream error:', data.message);
                        break;

                    case 'podcast_status':
                        store.setPodcastStatus(data.status);
                        break;
                }
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        };

        return () => {
            ws.current?.close();
            clearInterval(pollingInterval);
        };
    }, [courseId]);
};
