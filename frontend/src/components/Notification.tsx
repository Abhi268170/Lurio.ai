import React, { useEffect, useState } from 'react';

interface NotificationProps {
    message: string;
    onClose: () => void;
}

export const Notification: React.FC<NotificationProps> = ({ message, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Slide in animation
        setTimeout(() => setIsVisible(true), 100);

        // Auto-close after 5 seconds
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
        }, 5000);

        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
            }`}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center gap-3 min-w-[400px]">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-lg">P</span>
                </div>
                <p className="text-slate-900 dark:text-white font-medium flex-1">{message}</p>
                <button onClick={() => {
                    setIsVisible(false);
                    setTimeout(onClose, 300);
                }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <span className="material-icons-round text-slate-400 text-sm">close</span>
                </button>
            </div>
        </div>
    );
};
