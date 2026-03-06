import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BookIcon from '../assets/open-book.png';
import { useTheme } from '../hooks/useTheme';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import api from '../api/axios';
import { useAuthStore } from '../stores/useAuthStore';

interface Course {
    id: number;
    title: string;
    topic: string;

    status: 'pending' | 'generating' | 'completed' | 'failed';
    progress?: number;
}

interface Journey {
    id: number;
    topic: string;
    created_at: string;
    nodes: any[];
}

export const CoursesListPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [activeTab, setActiveTab] = useState<'courses' | 'journeys'>('courses');
    const [hasMore, setHasMore] = useState(true);
    const limit = 9;
    const [courses, setCourses] = useState<Course[]>([]);
    const [journeys, setJourneys] = useState<Journey[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    
    const user = useAuthStore(state => state.user);
    const logout = useAuthStore(state => state.logout);

    const [courseToDelete, setCourseToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchData = async (pageVal: number) => {
        setLoading(true);
        try {
            const skip = (pageVal - 1) * limit;
            const endpoint = activeTab === 'courses' 
                ? `/courses/?skip=${skip}&limit=${limit}`
                : `/journeys/?skip=${skip}&limit=${limit}`;
                
            const response = await api.get(endpoint);
            const data = response.data;
            if (data.length < limit) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }
            
            if (activeTab === 'courses') {
                setCourses(data);
            } else {
                setJourneys(data);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(page);
    }, [page, activeTab]);

    const handleNextPage = () => {
        setPage(prev => prev + 1);
    };

    const handlePrevPage = () => {
        setPage(prev => Math.max(prev - 1, 1));
    };

    const confirmDelete = (e: React.MouseEvent, courseId: number) => {
        e.stopPropagation();
        setCourseToDelete(courseId);
    };

    const handleDelete = async () => {
        if (!courseToDelete) return;
        setIsDeleting(true);

        try {
            await api.delete(`/courses/${courseToDelete}`);
            // Refresh current page
            fetchData(page);
        } catch (error) {
            console.error('Failed to delete course:', error);
        } finally {
            setIsDeleting(false);
            setCourseToDelete(null); // Close modal
        }
    };

    const handleDownload = (e: React.MouseEvent, courseId: number, status: string) => {
        e.stopPropagation();
        if (status !== 'completed') {
            alert("Please wait for the course to complete generation.");
            return;
        }
        // Use full URL for direct download or api.get with blob if preferred
        const token = useAuthStore.getState().token;
        window.location.href = `http://localhost:8000/api/v1/courses/${courseId}/download?token=${token}`;
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
            <DeleteConfirmationModal
                isOpen={!!courseToDelete}
                onClose={() => setCourseToDelete(null)}
                onConfirm={handleDelete}
                isDeleting={isDeleting}
            />
            {/* Header */}
            <header className="flex-shrink-0 z-30 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
                <div className="max-w-[95%] xl:max-w-[1800px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="bg-primary p-2 rounded-lg">
                            <span className="material-icons-round text-white text-xl">auto_stories</span>
                        </div>
                        <h1 className="font-display text-xl md:text-2xl text-slate-800 dark:text-white">
                            Lurio
                        </h1>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        >
                            <span className="material-icons-round text-slate-600 dark:text-slate-400">
                                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                            </span>
                        </button>

                        {user && (
                            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs font-bold text-slate-800 dark:text-white leading-none mb-0.5">{user.full_name || user.email}</p>
                                    <button onClick={() => logout()} className="text-[10px] text-slate-400 hover:text-primary transition-colors uppercase tracking-widest font-bold">Sign Out</button>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                    {(user.full_name || user.email)[0].toUpperCase()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-12">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-6">
                        <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">My Library</h2>
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                            <button
                                onClick={() => { setActiveTab('courses'); setPage(1); }}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'courses' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                Courses
                            </button>
                            <button
                                onClick={() => { setActiveTab('journeys'); setPage(1); }}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'journeys' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                Journeys
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:opacity-90 shadow-lg shadow-primary/20 transition-all"
                    >
                        <span className="material-icons-round">add_circle_outline</span>
                        Generate New
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <span className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                            {activeTab === 'courses' ? courses.map((course) => (
                                <div
                                    key={course.id}
                                    onClick={() => navigate(`/courses/${course.id}`)}
                                    className="group bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col items-center text-center relative"
                                >
                                    <div className="absolute top-4 right-4 flex gap-1">
                                        <button
                                            onClick={(e) => handleDownload(e, course.id, course.status)}
                                            className={`p-2 transition-colors ${course.status === 'completed' ? 'text-slate-300 hover:text-primary' : 'text-slate-200 dark:text-slate-700 cursor-not-allowed'}`}
                                            title="Download Course"
                                            disabled={course.status !== 'completed'}
                                        >
                                            <span className="material-icons-round">download</span>
                                        </button>
                                        <button
                                            onClick={(e) => confirmDelete(e, course.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                            title="Delete Course"
                                        >
                                            <span className="material-icons-round">delete_outline</span>
                                        </button>
                                    </div>

                                    <div className="w-24 h-24 mb-6 relative">
                                        <div className="absolute inset-0 bg-primary/10 rounded-full scale-0 group-hover:scale-110 transition-transform duration-300"></div>
                                        <img
                                            src={BookIcon}
                                            alt="Course Book"
                                            className="w-full h-full object-contain relative z-10 drop-shadow-md"
                                        />
                                    </div>

                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                                        {course.title}
                                    </h3>

                                    <div className="w-full mt-auto">
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                {course.status === 'completed' ? 'Progress' : 'Generating'}
                                            </p>
                                            <span className="text-xs font-bold text-primary">
                                                {course.progress || 0}%
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                                                style={{ width: `${course.progress || 0}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            )) : journeys.map((journey) => (
                                <div
                                    key={journey.id}
                                    onClick={() => navigate(`/journeys/${journey.id}`)}
                                    className="group bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col items-center text-center relative"
                                >
                                    <div className="w-24 h-24 mb-6 relative flex items-center justify-center">
                                        <div className="absolute inset-0 bg-teal-50 dark:bg-teal-900/20 rounded-full scale-0 group-hover:scale-110 transition-transform duration-300"></div>
                                        <span className="material-icons-round text-6xl text-teal-500 dark:text-teal-400 relative z-10">map</span>
                                    </div>

                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-teal-500 transition-colors">
                                        {journey.topic}
                                    </h3>
                                    
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                        {journey.nodes?.length || 1} discovered nodes
                                    </p>

                                    <div className="w-full mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
                                            Continue Journey
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination Controls - only show when there are items */}
                        {((activeTab === 'courses' && courses.length > 0) || (activeTab === 'journeys' && journeys.length > 0)) && (
                            <div className="flex justify-center items-center gap-4">
                                <button
                                    onClick={handlePrevPage}
                                    disabled={page === 1}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${page === 1
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                        }`}
                                >
                                    Previous
                                </button>
                                <span className="text-slate-600 dark:text-slate-400">
                                    Page {page}
                                </span>
                                <button
                                    onClick={handleNextPage}
                                    disabled={!hasMore}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${!hasMore
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                        }`}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}

                {!loading && (
                    (activeTab === 'courses' && courses.length === 0 && page === 1) ||
                    (activeTab === 'journeys' && journeys.length === 0 && page === 1)
                ) && (
                    <div className="text-center py-12">
                        <p className="text-slate-500 dark:text-slate-400 text-lg mb-4">
                            {activeTab === 'courses' ? 'No completed courses found.' : 'No journeys found.'}
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
                        >
                            {activeTab === 'courses' ? 'Generate New Course' : 'Start a New Journey'}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};
