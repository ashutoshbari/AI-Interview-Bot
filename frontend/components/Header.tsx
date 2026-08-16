'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Verify', href: '/verify' },
    { label: 'Interview', href: '/interview' },
    { label: 'Scorecard', href: '/report' },
  ];

  return (
    <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
      <div className="glass-panel rounded-full px-4 sm:px-6 py-3 flex items-center justify-between gap-4 border border-white/10 shadow-2xl backdrop-blur-2xl">
        
        {/* Left: Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-purple-500/30 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-cyan-300 font-black text-sm">
              ✨
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
              Smart Interview AI
            </span>
            <span className="text-[9px] font-mono tracking-widest text-cyan-400 uppercase font-semibold">
              NEXT-GEN HIRING
            </span>
          </div>
        </Link>

        {/* Center Nav Pills */}
        <nav className="hidden md:flex items-center gap-1.5 bg-white/5 p-1 rounded-full border border-white/10">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <span className="px-4 py-1.5 text-xs text-white/30 cursor-not-allowed">Dashboard</span>
          <span className="px-4 py-1.5 text-xs text-white/30 cursor-not-allowed">Candidates</span>
        </nav>

        {/* Right CTA Button */}
        <Link
          href="/"
          className="btn-primary text-xs px-5 py-2.5 rounded-full font-extrabold shadow-lg shadow-purple-500/30 flex items-center gap-2"
        >
          <span>Start Interview</span>
        </Link>
      </div>
    </header>
  );
}
