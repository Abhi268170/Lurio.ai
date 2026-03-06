import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { ContentArea } from '../components/ContentArea';
import { Notification } from '../components/Notification';
import { useCourseStream } from '../hooks/useCourseStream';
import { useCourseStore } from '../stores/courseStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useTheme } from '../hooks/useTheme';
import clsx from 'clsx';

import { PopoChat } from '../components/PopoChat';
import { PappyChat } from '../components/PappyChat';
import { PopoCheckpoint } from '../components/PopoCheckpoint';
import { FlashcardDeck } from '../components/FlashcardDeck';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { LearningFeedbackModal } from '../components/LearningFeedbackModal';


export const CoursePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    useCourseStream(id);
    const { title, modules, journeyId, courseId, podcastStatus, generatePodcast, showFeedbackForm, setShowFeedbackForm } = useCourseStore();
    const { theme, toggleTheme } = useTheme();
    const [showNotification, setShowNotification] = useState(false);
    const [notificationShown, setNotificationShown] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showPodcastPlayer, setShowPodcastPlayer] = useState(false);
    const [podcastAudioUrl, setPodcastAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        // Cleanup object URL
        return () => {
            if (podcastAudioUrl) URL.revokeObjectURL(podcastAudioUrl);
        };
    }, [podcastAudioUrl]);

    useEffect(() => {
        // Fetch podcast audio if player is shown
        const fetchPodcastAudio = async () => {
            if (showPodcastPlayer && podcastStatus === 'completed' && courseId && !podcastAudioUrl) {
                try {
                    const token = useAuthStore.getState().token;
                    const response = await fetch(`http://localhost:8000/api/v1/courses/${courseId}/podcast/audio`, {
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                    });
                    if (response.ok) {
                        const blob = await response.blob();
                        const url = URL.createObjectURL(blob);
                        setPodcastAudioUrl(url);
                    }
                } catch (e) {
                    console.error("Failed to fetch podcast audio", e);
                }
            }
        };
        fetchPodcastAudio();
    }, [showPodcastPlayer, podcastStatus, courseId, podcastAudioUrl]);

    useEffect(() => {
        // Check if all lesson modules are completed
        const lessonModules = modules.filter(m => m.module_type === 'lesson' || !m.module_type);
        const allCompleted = lessonModules.length > 0 && lessonModules.every((m: any) => m.status?.toLowerCase() === 'completed');
        if (allCompleted && !notificationShown) {
            setShowNotification(true);
            setNotificationShown(true);
        }
    }, [modules, notificationShown]);

    const navigate = useNavigate();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const token = useAuthStore.getState().token;
            const response = await fetch(`http://localhost:8000/api/v1/courses/${id}`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            if (response.ok) {
                navigate('/courses');
            }
        } catch (error) {
            console.error('Failed to delete course:', error);
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    const handleDownload = async () => {
        const lessonModules = modules.filter(m => m.module_type === 'lesson' || !m.module_type);
        const isCourseCompleted = lessonModules.length > 0 && lessonModules.every((m: any) => m.status?.toLowerCase() === 'completed');

        if (!isCourseCompleted || !id) {
            alert("Please wait for all modules to generate before downloading.");
            return;
        }
        
        try {
            const token = useAuthStore.getState().token;
            const response = await fetch(`http://localhost:8000/api/v1/courses/${id}/download`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${title.replace(/\s+/g, '_') || 'course'}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error("Failed to download course", e);
        }
    };

    const handlePodcast = async () => {
        if (podcastStatus === 'completed') {
            setShowPodcastPlayer(!showPodcastPlayer);
        } else if (!podcastStatus || podcastStatus === 'failed') {
            await generatePodcast();
        }
    };

    const handleMindmap = () => navigate(`/courses/${id}/mindmap`);

    const lessonModules = modules.filter(m => m.module_type === 'lesson' || !m.module_type);
    const isReadyToDownload = lessonModules.length > 0 && lessonModules.every((m: any) => m.status?.toLowerCase() === 'completed');
    const isCourseCompleted = isReadyToDownload || podcastStatus === 'completed';

    return (
        <div className="h-screen flex flex-col bg-background-light dark:bg-background-dark font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200 overflow-hidden">
            <FlashcardDeck />
            <PopoCheckpoint />
            {showFeedbackForm && (
                <LearningFeedbackModal onClose={() => setShowFeedbackForm(false)} />
            )}
            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                isDeleting={isDeleting}
            />
            {/* Header */}
            <header className="flex-shrink-0 z-30 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
                <div className="max-w-[95%] xl:max-w-[1800px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/courses')}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
                            title="Back to Courses"
                        >
                            <span className="material-icons-round">arrow_back</span>
                        </button>
                        <div className="bg-primary p-2 rounded-lg hidden sm:block">
                            <span className="material-icons-round text-white text-xl">auto_stories</span>
                        </div>
                        <h1 className="font-display text-xl md:text-2xl text-slate-800 dark:text-white truncate max-w-md">
                            {title || "Lurio"}
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        {journeyId && (
                            <button
                                onClick={() => navigate(`/journeys/${journeyId}`)}
                                className="flex items-center gap-2 px-4 py-2 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors font-medium text-sm"
                            >
                                <span className="material-icons-round text-sm">map</span>
                                View in Journey Map
                            </button>
                        )}

                        {/* Mind Map Button */}
                        <button
                            onClick={handleMindmap}
                            disabled={!isReadyToDownload}
                            className={clsx(
                                "p-2 transition-colors",
                                isReadyToDownload ? "text-slate-400 hover:text-teal-500 cursor-pointer" : "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                            )}
                            title={isReadyToDownload ? "Open Mind Map" : "Complete course first"}
                        >
                            <span className="material-icons-round">account_tree</span>
                        </button>

                        {/* Podcast Button */}
                        <button
                            onClick={handlePodcast}
                            disabled={!isCourseCompleted || podcastStatus === 'generating'}
                            className={clsx(
                                "p-2 transition-all relative",
                                podcastStatus === 'generating' && "text-amber-500 animate-pulse cursor-wait",
                                podcastStatus === 'completed' && "text-primary hover:text-primary/80 cursor-pointer",
                                podcastStatus === 'failed' && "text-red-400 hover:text-red-500 cursor-pointer",
                                !podcastStatus && isCourseCompleted && "text-slate-400 hover:text-primary cursor-pointer",
                                !isCourseCompleted && "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                            )}
                            title={
                                podcastStatus === 'generating' ? 'Generating podcast...' :
                                    podcastStatus === 'completed' ? 'Play/Hide podcast' :
                                        podcastStatus === 'failed' ? 'Retry podcast generation' :
                                            isCourseCompleted ? 'Generate Podcast' : 'Complete course first'
                            }
                        >
                            <span className="material-icons-round">podcasts</span>
                            {podcastStatus === 'generating' && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-ping"></span>
                            )}
                        </button>

                        <button
                            onClick={handleDownload}
                            disabled={!isReadyToDownload}
                            className={clsx(
                                "p-2 transition-colors",
                                isReadyToDownload ? "text-slate-400 hover:text-primary cursor-pointer" : "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                            )}
                            title={isReadyToDownload ? "Download Course" : "Wait for generation to complete"}
                        >
                            <span className="material-icons-round">download</span>
                        </button>

                        <button
                            onClick={() => setIsDeleteModalOpen(true)}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            title="Delete Course"
                        >
                            <span className="material-icons-round">delete_outline</span>
                        </button>

                        <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700"></div>

                        <div className="hidden md:flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">COURSE PROGRESS</span>
                                <span className="text-xs font-bold text-primary">
                                    {Math.round((modules.filter(m => m.is_completed_by_user).length / Math.max(modules.length, 1)) * 100)}%
                                </span>
                            </div>
                            <div className="w-48 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${(modules.filter(m => m.is_completed_by_user).length / Math.max(modules.length, 1)) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        >
                            <span className="material-icons-round text-slate-600 dark:text-slate-400">
                                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                            </span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Podcast Player Bar */}
            {showPodcastPlayer && podcastStatus === 'completed' && courseId && podcastAudioUrl && (
                <div className="flex-shrink-0 z-20 bg-gradient-to-r from-purple-600/10 via-indigo-600/10 to-blue-600/10 dark:from-purple-900/20 dark:via-indigo-900/20 dark:to-blue-900/20 border-b border-slate-200 dark:border-slate-800">
                    <div className="max-w-[95%] xl:max-w-[1800px] mx-auto px-6 py-3 flex items-center gap-4">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="material-icons-round text-primary text-lg">podcasts</span>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Course Podcast</span>
                        </div>
                        <audio
                            ref={audioRef}
                            controls
                            className="flex-1 h-10"
                            src={podcastAudioUrl}
                        >
                            Your browser does not support the audio element.
                        </audio>
                        <button
                            onClick={() => setShowPodcastPlayer(false)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            <span className="material-icons-round text-sm">close</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Main Layout */}
            <main className="flex-1 min-h-0 w-full max-w-[95%] xl:max-w-[1800px] mx-auto px-6 py-6 flex flex-col lg:flex-row gap-6">
                <Sidebar />
                <ContentArea />
                <PopoChat />
                <PappyChat />
            </main>

            {/* Notification */}
            {showNotification && (
                <Notification
                    message="The course is ready and Popo can help you with it"
                    onClose={() => setShowNotification(false)}
                />
            )}
        </div>
    );
};
