import React, { useState, useEffect, useRef } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useCourseStore } from '../stores/courseStore';
import { useAuthStore } from '../stores/useAuthStore';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export const PopoChat: React.FC = () => {
    const { isChatOpen, chatInitialText, toggleChat, activeModuleId, modules, topic, provider, model } = useCourseStore();
    const token = useAuthStore(state => state.token);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [followUpCount, setFollowUpCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Derived state
    const activeModule = modules.find(m => m.id === activeModuleId);
    const moduleTitle = activeModule?.title || 'Current Module';
    const apiKey = localStorage.getItem(`lurio_key_${provider}`);

    useEffect(() => {
        if (isChatOpen && chatInitialText) {
            // Initial question with streaming
            const askInitial = async () => {
                setMessages([{ role: 'user', content: chatInitialText }]);
                setIsLoading(true);

                try {
                    console.log('DEBUG: Popo token exists:', !!token);
                    console.log('Sending request to Popo API (streaming)...', { initialText: chatInitialText, topic, moduleTitle, provider, model });

                    const response = await fetch('http://localhost:8000/api/v1/popo/ask/stream', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        body: JSON.stringify({
                            text: chatInitialText,
                            history: [],
                            topic,
                            module_title: moduleTitle,
                            provider,
                            model,
                            api_key: apiKey
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status} `);
                    }

                    const reader = response.body?.getReader();
                    const decoder = new TextDecoder();
                    let accumulatedText = '';

                    // Add empty assistant message that we'll update
                    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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
                                    setMessages(prev => {
                                        const newMessages = [...prev];
                                        newMessages[newMessages.length - 1].content = accumulatedText;
                                        return newMessages;
                                    });
                                }
                                if (data.error) {
                                    throw new Error(data.error);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Popo error:', error);
                    setMessages(prev => [...prev, { role: 'assistant', content: `Oops! Popo had trouble: ${error instanceof Error ? error.message : 'Unknown error'} ` }]);
                } finally {
                    setIsLoading(false);
                }
            };

            askInitial();
        } else if (!isChatOpen) {
            // Reset state when closed
            setMessages([]);
            setFollowUpCount(0);
        }
    }, [isChatOpen, chatInitialText, topic, moduleTitle, token]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!input.trim() || followUpCount >= 2) return;

        const userMessage: Message = { role: 'user', content: input };
        const currentInput = input;

        // Build the updated message history including the new user message
        const updatedMessages = [...messages, userMessage];

        setMessages(updatedMessages);
        setInput('');
        setIsLoading(true);

        try {
            console.log('Sending follow-up to Popo (streaming):', currentInput);

            const response = await fetch('http://localhost:8000/api/v1/popo/ask/stream', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    text: currentInput,
                    history: updatedMessages,
                    topic,
                    module_title: moduleTitle,
                    provider,
                    model,
                    api_key: apiKey
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} `);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = '';

            const newFollowUpCount = followUpCount + 1;
            setFollowUpCount(newFollowUpCount);

            // Add empty assistant message
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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
                            setMessages(prev => {
                                const newMessages = [...prev];
                                newMessages[newMessages.length - 1].content = accumulatedText;
                                return newMessages;
                            });
                        }
                        if (data.error) {
                            throw new Error(data.error);
                        }
                    }
                }
            }

            if (newFollowUpCount === 2) {
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content += '\n\nHope that helps, captain popo saves the day bye!';
                    return newMessages;
                });
            }
        } catch (error) {
            console.error('Popo error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Oops! Popo had trouble with that one!' }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isChatOpen) return null;

    return (
        <aside className="w-[380px] h-full flex flex-col bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative transition-all duration-300">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 font-bold border border-orange-200 dark:border-orange-800">
                        P
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Captain Popo</h4>
                        <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Your friendly learning assistant</p>
                    </div>
                </div>
                <button
                    onClick={() => toggleChat(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                    <span className="material-icons text-xl">close</span>
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide" ref={scrollRef}>
                {/* Lottie Animation (Scrolls with content) */}
                <div className="w-full flex justify-center pb-2">
                    <div className="w-48 h-48">
                        <DotLottieReact
                            src="https://lottie.host/073f508e-b3d5-4654-a7bb-b957ca581210/LrYzYyPEiN.lottie"
                            loop
                            autoplay
                        />
                    </div>
                </div>

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-orange-600 mr-3 mt-1">P</div>
                        )}
                        <div className={`max-w-[85%] p-4 rounded-2xl ${msg.role === 'user'
                            ? 'bg-primary text-white rounded-tr-none'
                            : 'bg-white dark:bg-slate-800 rounded-tl-none border border-slate-100 dark:border-slate-700 shadow-sm'
                            }`}>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-orange-600">P</div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div className="flex gap-1.5">
                                <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-6 pt-2 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-t border-slate-100 dark:border-slate-800">
                {followUpCount < 2 ? (
                    <>
                        <div className="relative group">
                            <input
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all shadow-sm outline-none"
                                placeholder="Ask a follow-up question..."
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className="absolute right-2 top-2 bottom-2 aspect-square bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-icons text-sm">send</span>
                            </button>
                        </div>
                        <div className="mt-3 flex justify-between items-center px-1">
                            <p className="text-[10px] text-slate-400 font-medium">
                                {2 - followUpCount} follow-up question{2 - followUpCount !== 1 ? 's' : ''} remaining
                            </p>
                            <div className="flex gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${followUpCount === 0 ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}></span>
                                <span className={`w-1.5 h-1.5 rounded-full ${followUpCount <= 1 ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}></span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs text-slate-500">
                        Chat limits reached. Start a new selection to ask more!
                    </div>
                )}
            </div>
        </aside>
    );
};
