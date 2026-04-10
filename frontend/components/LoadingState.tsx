'use client';

import { useState, useEffect } from 'react';

interface LoadingStateProps {
    messages: string[];
    interval?: number; // ms
    title?: string;
    showProgress?: boolean;
}

export default function LoadingState({
    messages,
    interval = 1500,
    title = "Please wait",
    showProgress = true
}: LoadingStateProps) {
    const [msgIdx, setMsgIdx] = useState(0);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const msgTimer = setInterval(() => {
            setMsgIdx((current) => (current + 1) % messages.length);
        }, interval);

        const progTimer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 95) return prev;
                return prev + 0.5;
            });
        }, 100);

        return () => {
            clearInterval(msgTimer);
            clearInterval(progTimer);
        };
    }, [messages, interval]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full max-w-md mx-auto p-8 animate-fade-in text-center">
            {/* Premium Animated AI Icon */}
            <div className="relative w-32 h-32 mb-10">
                {/* Multi-layered glow/pulse */}
                <div className="absolute inset-0 rounded-full bg-primary-500/10 animate-ping" style={{ animationDuration: '3s' }} />
                <div className="absolute inset-4 rounded-full bg-primary-500/15 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.2s' }} />
                <div className="absolute inset-8 rounded-full bg-primary-600/20 animate-pulse" style={{ animationDuration: '2s' }} />

                {/* Central Icon Container */}
                <div className="relative flex items-center justify-center w-full h-full rounded-full bg-gradient-to-br from-primary-500/30 to-purple-600/30 border border-primary-400/30 backdrop-blur-xl shadow-2xl shadow-primary-500/20">
                    <svg className="w-14 h-14 text-primary-300 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>

                    {/* Orbiting particles */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary-400 blur-[1px] animate-orbit" />
                </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">{title}</h2>

            <div className="h-10 flex items-center justify-center mb-8">
                <p className="text-primary-200/80 text-lg font-medium animate-slide-up-fade" key={msgIdx}>
                    {messages[msgIdx]}
                </p>
            </div>

            {showProgress && (
                <div className="w-full space-y-3">
                    <div className="w-full bg-white/5 border border-white/10 rounded-full h-2.5 p-0.5 overflow-hidden shadow-inner">
                        <div
                            className="bg-gradient-to-r from-primary-500 via-purple-500 to-primary-400 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-white/30 text-[10px] uppercase tracking-[0.2em] font-bold">Optimizing Performance</p>
                </div>
            )}
        </div>
    );
}
