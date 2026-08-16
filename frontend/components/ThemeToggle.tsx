'use client';

import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('ashvance_theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = prefersDark ? 'dark' : 'light';
      setTheme(initial);
      applyTheme(initial);
    }
  }, []);

  const applyTheme = (t: 'dark' | 'light') => {
    const root = document.documentElement;
    if (t === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('ashvance_theme', nextTheme);
    applyTheme(nextTheme);
  };

  if (!mounted) {
    return (
      <div className="w-16 h-8 rounded-full bg-white/5 border border-white/10" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="relative flex items-center justify-between w-[72px] h-[34px] p-1 rounded-full transition-all duration-300 border shadow-inner cursor-pointer"
      style={{
        backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(241, 245, 249, 0.9)',
        borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.15)',
      }}
    >
      {/* Sun Icon */}
      <span
        className={`text-xs transition-opacity duration-300 ml-1.5 select-none ${
          theme === 'light' ? 'opacity-100 text-amber-500 font-bold' : 'opacity-40'
        }`}
      >
        ☀️
      </span>

      {/* Moon Icon */}
      <span
        className={`text-xs transition-opacity duration-300 mr-1.5 select-none ${
          theme === 'dark' ? 'opacity-100 text-cyan-300 font-bold' : 'opacity-40'
        }`}
      >
        🌙
      </span>

      {/* Sliding Thumb Knob */}
      <div
        className="absolute top-1 w-6 h-6 rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-out"
        style={{
          transform: theme === 'dark' ? 'translateX(38px)' : 'translateX(0px)',
          background:
            theme === 'dark'
              ? 'linear-gradient(135deg, #7c3aed 0%, #0088cc 100%)'
              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        }}
      >
        <span className="text-[10px] text-white">
          {theme === 'dark' ? '✦' : '☼'}
        </span>
      </div>
    </button>
  );
}
