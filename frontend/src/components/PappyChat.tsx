import React, { useState, useEffect, useRef } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useCourseStore } from '../stores/courseStore';

export const PappyChat: React.FC = () => {
    const { 
        isPappyChatOpen, 
        pappyMessages, 
        isPappyLoading, 
        togglePappyChat, 
        sendPappyMessage,
        activeModuleId,
        resetPappyChat
    } = useCourseStore();
    
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [pappyMessages, isPappyLoading]);

    // Reset when switching modules
    useEffect(() => {
        resetPappyChat();
    }, [activeModuleId]);

    if (!isPappyChatOpen) return null;

    const handleSend = () => {
        if (!input.trim() || isPappyLoading) return;
        sendPappyMessage(input);
        setInput('');
    };

    return (
        <aside className="w-[380px] h-full flex flex-col bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-teal-200 dark:border-teal-900 shadow-xl overflow-hidden relative transition-all duration-300">
            {/* Header */}
            <div className="p-6 border-b border-teal-100 dark:border-teal-900/50 flex items-center justify-between bg-teal-50/30 dark:bg-teal-900/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-600 dark:text-teal-400 font-bold border border-teal-200 dark:border-teal-800">
                        P
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Pappy the Pupil</h4>
                        <p className="text-[10px] text-teal-500 dark:text-teal-400 uppercase tracking-tighter font-bold">Feynman Teach Mode</p>
                    </div>
                </div>
                <button
                    onClick={() => togglePappyChat(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                    <span className="material-icons text-xl">close</span>
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide" ref={scrollRef}>
                {/* Lottie Animation */}
                <div className="w-full flex justify-center pb-2">
                    <div className="w-40 h-40">
                        <DotLottieReact
                            src="https://lottie.host/025c21cb-4297-42e7-8185-51a0edce1bde/vsKIwhGHmD.lottie"
                            loop
                            autoplay
                        />
                    </div>
                </div>

                {pappyMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-teal-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-teal-600 mr-3 mt-1">P</div>
                        )}
                        <div className={`max-w-[85%] p-4 rounded-2xl ${msg.role === 'user'
                            ? 'bg-teal-600 text-white rounded-tr-none shadow-md shadow-teal-600/20'
                            : 'bg-white dark:bg-slate-800 rounded-tl-none border border-teal-50 dark:border-slate-700 shadow-sm'
                            }`}>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                    </div>
                ))}

                {isPappyLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-teal-600">P</div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-teal-50 dark:border-slate-700 shadow-sm">
                            <div className="flex gap-1.5">
                                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-6 pt-2 bg-teal-50/20 dark:bg-slate-900/50 backdrop-blur-sm border-t border-teal-100 dark:border-teal-900/30">
                <div className="relative group">
                    <input
                        className="w-full bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all shadow-sm outline-none"
                        placeholder="Teach Pappy simply..."
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        disabled={isPappyLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isPappyLoading}
                        className="absolute right-2 top-2 bottom-2 aspect-square bg-teal-600/10 text-teal-600 hover:bg-teal-600 hover:text-white rounded-lg transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-icons text-sm">school</span>
                    </button>
                </div>
                <p className="mt-2 text-[10px] text-slate-400 text-center italic">
                    Tip: Use analogies and simple words to help Pappy learn!
                </p>
            </div>
        </aside>
    );
};
