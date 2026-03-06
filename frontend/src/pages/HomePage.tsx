import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../stores/useAuthStore';

export const HomePage: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [difficulty, setDifficulty] = useState('beginner');
    const [mode, setMode] = useState<'course' | 'journey'>('course');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Syllabus preview state (course mode only)
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [syllabusOptions, setSyllabusOptions] = useState<string[][] | null>(null);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);

    const navigate = useNavigate();

    const user = useAuthStore(state => state.user);
    const logout = useAuthStore(state => state.logout);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!topic.trim()) return;

        // Journey mode: direct creation, no preview
        if (mode === 'journey') {
            setIsSubmitting(true);
            setError(null);
            try {
                const response = await api.post('/journeys/', { topic, difficulty });
                navigate(`/journeys/${response.data.id}`);
            } catch (err) {
                console.error(err);
                setError('Failed to create journey. Please check backend connection.');
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        // Course mode: fetch syllabus preview first
        setIsSubmitting(true);
        setError(null);
        setSyllabusOptions(null);
        setSelectedOptionIndex(null);

        try {
            const response = await api.post('/courses/syllabus-preview', { topic, difficulty });
            setSyllabusOptions(response.data.options);
            setIsPreviewing(true);
        } catch (err) {
            console.error(err);
            setError('Failed to generate syllabus options. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateCourse = async () => {
        if (selectedOptionIndex === null || !syllabusOptions) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await api.post('/courses/', {
                topic,
                difficulty,
                module_titles: syllabusOptions[selectedOptionIndex],
            });
            navigate(`/courses/${response.data.id}`);
        } catch (err) {
            console.error(err);
            setError('Failed to create course. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetPreview = () => {
        setIsPreviewing(false);
        setSyllabusOptions(null);
        setSelectedOptionIndex(null);
    };

    return (
        <div className="bg-background-light dark:bg-background-dark text-navy-dark dark:text-gray-100 min-h-screen transition-colors duration-300 overflow-x-hidden font-sans">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'radial-gradient(#C19A83 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}></div>
            <div className="fixed top-[-10%] left-[-5%] w-[40%] h-[40%] bg-primary opacity-[0.03] blur-[120px] rounded-full pointer-events-none"></div>
            <div className="fixed bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary opacity-[0.03] blur-[120px] rounded-full pointer-events-none"></div>

            {/* Navbar */}
            <nav className="relative z-10 max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-3xl">auto_stories</span>
                    <span className="font-display text-2xl font-bold text-navy-dark dark:text-white tracking-tight">Lurio</span>
                </div>
                <div className="flex items-center gap-6">
                    <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors" onClick={() => document.documentElement.classList.toggle('dark')}>
                        <span className="material-symbols-outlined block dark:hidden">dark_mode</span>
                        <span className="material-symbols-outlined hidden dark:block">light_mode</span>
                    </button>
                    <a className="text-sm font-medium hover:text-primary transition-colors" href="/courses">My Library</a>
                    
                    {user ? (
                        <div className="flex items-center gap-4 pl-4 border-l border-gray-200 dark:border-slate-700">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-navy-dark dark:text-white leading-none mb-0.5">{user.full_name || user.email}</p>
                                <button onClick={() => logout()} className="text-[10px] text-gray-400 hover:text-primary transition-colors uppercase tracking-widest font-bold">Sign Out</button>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                {(user.full_name || user.email)[0].toUpperCase()}
                            </div>
                        </div>
                    ) : (
                        <a className="px-5 py-2.5 bg-navy-dark dark:bg-white text-white dark:text-navy-dark rounded-full text-sm font-semibold hover:opacity-90 transition-all shadow-sm" href="/login">Sign In</a>
                    )}
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-32">
                <div className="max-w-4xl w-full text-center space-y-8">
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-xs font-bold tracking-widest uppercase rounded-full border border-primary/20">
                            Next-Gen Learning
                        </span>
                        <h1 className="font-display text-6xl md:text-8xl text-navy-dark dark:text-white leading-[1.1] tracking-tight">
                            Master any subject <br />
                            <span className="italic text-primary font-normal">instantly.</span>
                        </h1>
                        <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                            Lurio uses advanced artificial intelligence to architect custom, comprehensive courses tailored specifically to your learning goals.
                        </p>
                    </div>

                    <div className="mt-12 bg-white dark:bg-slate-800/50 p-3 md:p-4 rounded-[2rem] shadow-2xl shadow-navy-dark/5 dark:shadow-none border border-gray-100 dark:border-slate-700 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
                        {/* Mode Switcher */}
                        <div className="flex justify-center mb-4">
                            <div className="bg-gray-100 dark:bg-slate-900/50 p-1 rounded-xl flex gap-1">
                                <button
                                    onClick={() => { setMode('course'); handleResetPreview(); }}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                                        mode === 'course'
                                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Single Course
                                </button>
                                <button
                                    onClick={() => { setMode('journey'); handleResetPreview(); }}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                                        mode === 'journey'
                                        ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <span className="material-icons-round text-sm">hub</span>
                                    Journey
                                </button>
                            </div>
                        </div>

                        {/* Input Form */}
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="flex flex-col md:flex-row gap-3">
                                <div className="flex-1 relative group text-left">
                                    <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
                                        {mode === 'course' ? 'school' : 'explore'}
                                    </span>
                                    <input
                                        type="text"
                                        value={topic}
                                        onChange={(e) => { setTopic(e.target.value); handleResetPreview(); }}
                                        className="w-full pl-14 pr-6 py-4 md:py-5 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-2xl text-navy-dark dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all text-lg outline-none"
                                        placeholder={mode === 'course' ? "e.g. Introduction to Astrophysics" : "e.g. Artificial Intelligence"}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !topic.trim() || isPreviewing}
                                    className={`
                                        bg-primary hover:bg-[#B38B74] text-white px-10 py-4 md:py-5 rounded-2xl font-bold text-lg shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed
                                        ${mode === 'journey' ? '!bg-teal-600 hover:!bg-teal-700 !shadow-teal-600/25 hover:!shadow-teal-600/30' : ''}
                                    `}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            {mode === 'course' ? 'Building options...' : 'Starting...'}
                                        </>
                                    ) : (
                                        <>
                                            <span>{mode === 'course' ? 'Choose Syllabus' : 'Start Journey'}</span>
                                            <span className="material-symbols-outlined text-xl">
                                                {mode === 'course' ? 'list_alt' : 'map'}
                                            </span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Difficulty selector */}
                            <div className="border-t border-gray-50 dark:border-slate-700/50 mt-2 pt-4 px-2">
                                <div className="flex justify-center items-end">
                                    <div className="space-y-1.5 text-left w-full md:w-1/2 lg:w-1/4">
                                        <label htmlFor="difficulty" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 text-center">Difficulty Level</label>
                                        <div className="relative">
                                            <select
                                                id="difficulty"
                                                value={difficulty}
                                                onChange={(e) => setDifficulty(e.target.value)}
                                                className="w-full appearance-none bg-gray-50 dark:bg-slate-900/50 border border-gray-200/50 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all cursor-pointer text-center"
                                            >
                                                <option value="beginner">Beginner</option>
                                                <option value="intermediate">Intermediate</option>
                                                <option value="advanced">Advanced</option>
                                            </select>
                                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-lg">expand_more</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center justify-center gap-2 text-gray-400 text-[10px] italic font-medium uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-xs">auto_fix_high</span>
                                    AI-powered architecting for optimal learning flow
                                </div>
                            </div>
                        </form>

                        {/* Syllabus Preview: 3 options */}
                        {isPreviewing && syllabusOptions && (
                            <div className="mt-6 border-t border-gray-100 dark:border-slate-700 pt-6">
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pick your learning path</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Choose the syllabus that fits your goals</p>
                                    </div>
                                    <button onClick={handleResetPreview} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 font-semibold">
                                        <span className="material-icons-round text-sm">arrow_back</span>
                                        Change topic
                                    </button>
                                </div>

                                <div className="grid md:grid-cols-3 gap-3 mb-5">
                                    {syllabusOptions.map((option, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedOptionIndex(idx)}
                                            className={`text-left p-4 rounded-2xl border-2 transition-all ${
                                                selectedOptionIndex === idx
                                                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                                    : 'border-gray-200 dark:border-slate-700 hover:border-primary/40 bg-gray-50 dark:bg-slate-900/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                                    selectedOptionIndex === idx ? 'border-primary bg-primary' : 'border-gray-300 dark:border-slate-600'
                                                }`}>
                                                    {selectedOptionIndex === idx && (
                                                        <span className="material-icons-round text-white text-xs">check</span>
                                                    )}
                                                </div>
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Path {idx + 1}</span>
                                            </div>
                                            <ul className="space-y-1.5">
                                                {option.map((title, tIdx) => (
                                                    <li key={tIdx} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                                                        <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{tIdx + 1}</span>
                                                        {title}
                                                    </li>
                                                ))}
                                            </ul>
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={handleCreateCourse}
                                    disabled={selectedOptionIndex === null || isSubmitting}
                                    className="w-full bg-primary hover:bg-[#B38B74] text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-primary/25 hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            Creating Course...
                                        </>
                                    ) : (
                                        <>
                                            Start Learning
                                            <span className="material-symbols-outlined text-xl">bolt</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="mt-4 text-red-500 text-sm font-medium bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/20 text-left">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="pt-16 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                        <div className="flex flex-col items-center">
                            <span className="text-2xl font-bold text-navy-dark dark:text-white">100k+</span>
                            <span className="text-xs uppercase tracking-widest font-semibold text-gray-400">Courses Generated</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-2xl font-bold text-navy-dark dark:text-white">98%</span>
                            <span className="text-xs uppercase tracking-widest font-semibold text-gray-400">Satisfaction Rate</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-2xl font-bold text-navy-dark dark:text-white">2.4m</span>
                            <span className="text-xs uppercase tracking-widest font-semibold text-gray-400">Lessons Completed</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-2xl font-bold text-navy-dark dark:text-white">50+</span>
                            <span className="text-xs uppercase tracking-widest font-semibold text-gray-400">Global Languages</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Features Section */}
            <section className="max-w-7xl mx-auto px-6 py-24 border-t border-gray-100 dark:border-slate-800">
                <div className="grid md:grid-cols-3 gap-12">
                    <div className="space-y-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary">psychology</span>
                        </div>
                        <h3 className="text-xl font-bold text-navy-dark dark:text-white">Personalized Path</h3>
                        <p className="text-gray-500 dark:text-gray-400 leading-relaxed">Courses adapt to your prior knowledge and preferred learning speed.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary">auto_graph</span>
                        </div>
                        <h3 className="text-xl font-bold text-navy-dark dark:text-white">Curated Content</h3>
                        <p className="text-gray-500 dark:text-gray-400 leading-relaxed">Synthesizes the best educational resources from across the web into a cohesive flow.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary">workspace_premium</span>
                        </div>
                        <h3 className="text-xl font-bold text-navy-dark dark:text-white">Smart Assessment</h3>
                        <p className="text-gray-500 dark:text-gray-400 leading-relaxed">AI-generated quizzes and practical projects to validate your mastery of any topic.</p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-gray-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-2 opacity-70">
                    <span className="material-symbols-outlined text-primary">auto_stories</span>
                    <span className="font-display font-bold text-navy-dark dark:text-white">Lurio</span>
                </div>
                <p className="text-sm text-gray-400">© 2024 Lurio. The future of learning, powered by intelligence.</p>
                <div className="flex gap-6">
                    <a className="text-gray-400 hover:text-primary transition-colors" href="#"><span className="material-symbols-outlined">share</span></a>
                    <a className="text-gray-400 hover:text-primary transition-colors" href="#"><span className="material-symbols-outlined">help</span></a>
                </div>
            </footer>
        </div>
    );
};
