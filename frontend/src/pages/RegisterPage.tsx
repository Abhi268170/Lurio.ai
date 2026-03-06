import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import api from '../api/axios';
import { useAuthStore } from '../stores/useAuthStore';

export const RegisterPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const setAuth = useAuthStore(state => state.setAuth);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // 1. Register
            await api.post('/auth/register', {
                email,
                full_name: fullName,
                password
            });

            // 2. Login
            const formData = new FormData();
            formData.append('username', email);
            formData.append('password', password);

            const loginResponse = await api.post('/auth/login', formData);
            const { access_token } = loginResponse.data;

            // 3. Get user info
            const userResponse = await api.get('/auth/me', {
                headers: { Authorization: `Bearer ${access_token}` }
            });

            setAuth(access_token, userResponse.data);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to register. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setError(null);
        try {
            const response = await api.post('/auth/google', {
                credential: credentialResponse.credential,
            });
            const { access_token } = response.data;

            const userResponse = await api.get('/auth/me', {
                headers: { Authorization: `Bearer ${access_token}` }
            });

            setAuth(access_token, userResponse.data);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Google sign-up failed. Please try again.');
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark text-navy-dark dark:text-gray-100 min-h-screen transition-colors duration-300 flex flex-col font-sans overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'radial-gradient(#C19A83 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}></div>
            <div className="fixed top-[-10%] left-[-5%] w-[40%] h-[40%] bg-primary opacity-[0.03] blur-[120px] rounded-full pointer-events-none"></div>

            <nav className="relative z-10 max-w-7xl mx-auto w-full px-6 py-8 flex justify-between items-center">
                <Link to="/" className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-3xl">auto_stories</span>
                    <span className="font-display text-2xl font-bold text-navy-dark dark:text-white tracking-tight">Lurio</span>
                </Link>
            </nav>

            <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-20">
                <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Side: Animation */}
                    <div className="hidden lg:block animate-in fade-in slide-in-from-left-8 duration-1000">
                        <div className="relative">
                            <div className="absolute -inset-4 bg-primary/10 blur-3xl rounded-full"></div>
                            <DotLottieReact
                                src="https://lottie.host/8863848f-d2ae-4a88-b81f-333ed5211d8b/HCnYpUMfNY.lottie"
                                loop
                                autoplay
                                className="relative w-full h-[500px]"
                            />
                        </div>
                        <div className="mt-8 text-center lg:text-left">
                            <h2 className="text-3xl font-display font-bold text-navy-dark dark:text-white mb-4">Start Your Journey</h2>
                            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-md">Join thousands of learners and start building your custom learning path today.</p>
                        </div>
                    </div>

                    {/* Right Side: Register Card */}
                    <div className="w-full max-w-md mx-auto">
                        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <h1 className="font-display text-4xl font-bold text-navy-dark dark:text-white mb-2">Join Lurio</h1>
                            <p className="text-gray-500 dark:text-gray-400">Start your personalized learning experience</p>
                        </div>

                        <div className="bg-white dark:bg-slate-800/50 p-8 rounded-[2rem] shadow-2xl shadow-navy-dark/5 dark:shadow-none border border-gray-100 dark:border-slate-700 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
                            {/* Google Sign-Up */}
                            <div className="flex justify-center mb-6">
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess}
                                    onError={() => setError('Google sign-up failed. Please try again.')}
                                    size="large"
                                    width="360"
                                    text="signup_with"
                                    shape="pill"
                                />
                            </div>

                            {/* Divider */}
                            <div className="relative mb-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200 dark:border-slate-700"></div>
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className="px-3 bg-white dark:bg-slate-800/50 text-gray-400 uppercase tracking-widest font-bold">or</span>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Full Name</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors text-xl">person</span>
                                        <input
                                            type="text"
                                            required
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl text-navy-dark dark:text-white placeholder:text-gray-400 transition-all outline-none"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Email Address</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors text-xl">mail</span>
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl text-navy-dark dark:text-white placeholder:text-gray-400 transition-all outline-none"
                                            placeholder="name@example.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Password</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors text-xl">lock</span>
                                        <input
                                            type="password"
                                            required
                                            minLength={8}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 border-transparent focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl text-navy-dark dark:text-white placeholder:text-gray-400 transition-all outline-none"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="text-red-500 text-sm font-medium bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/20">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-primary hover:bg-[#B38B74] text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                >
                                    {isSubmitting ? (
                                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    ) : (
                                        <>
                                            <span>Create Account</span>
                                            <span className="material-symbols-outlined text-xl">arrow_forward</span>
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-8 pt-6 border-t border-gray-50 dark:border-slate-700/50 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Already have an account?{' '}
                                    <Link to="/login" className="text-primary font-bold hover:underline">Sign In</Link>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
