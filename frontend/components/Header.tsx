'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const navItems = [
    { label: 'Home', href: '/', icon: '🏠' },
    { label: 'Verify', href: '/verify', icon: '🔑' },
    { label: 'Interview', href: '/interview', icon: '🎙️' },
    { label: 'Scorecard', href: '/report', icon: '📊' },
  ];

  return (
    <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-2 relative z-40">
      <div className="glass-panel rounded-2xl sm:rounded-full px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 border border-[var(--border)] shadow-xl backdrop-blur-2xl">
        
        {/* Left: ASHVANCE TECH Brand & Logo */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          {/* Contrast-safe logo container */}
          <div className="bg-white p-1 sm:p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 group-hover:scale-105 transition-transform flex items-center justify-center">
            <Image
              src="/ashvance_logo.png"
              alt="ASHVANCE TECH Logo"
              width={105}
              height={32}
              className="object-contain h-6 sm:h-7 w-auto"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-black tracking-tight text-[var(--text-primary)]">
              Smart Interview AI
            </span>
            <span className="text-[9px] sm:text-[10px] font-mono tracking-wider text-[var(--secondary)] font-bold">
              ASHVANCE TECH
            </span>
          </div>
        </Link>

        {/* Center: Desktop Nav Pills (hidden on mobile) */}
        <nav className="hidden md:flex items-center gap-1 bg-[var(--surface-hover)] p-1 rounded-full border border-[var(--border)]">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Theme Toggle, CTA, and Mobile Hamburger Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          
          <Link
            href="/"
            className="hidden sm:inline-flex btn-primary text-xs px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-bold shadow-lg items-center gap-2"
          >
            <span>Start AI Interview</span>
          </Link>

          {/* Mobile Menu Button (thumb-friendly 44px) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle mobile menu"
            className="md:hidden w-11 h-11 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors focus:outline-none"
          >
            {mobileMenuOpen ? (
              <span className="text-lg font-bold">✕</span>
            ) : (
              <span className="text-xl">☰</span>
            )}
          </button>
        </div>

      </div>

      {/* ── Mobile Navigation Drawer / Bottom Sheet ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Slide-out Drawer */}
          <div className="fixed top-0 right-0 bottom-0 w-4/5 max-w-sm bg-[var(--bg-primary)] border-l border-[var(--border)] shadow-2xl p-6 flex flex-col justify-between z-10 overflow-y-auto">
            
            {/* Drawer Header */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <Image
                      src="/ashvance_logo.png"
                      alt="ASHVANCE TECH"
                      width={80}
                      height={24}
                      className="object-contain h-5 w-auto"
                    />
                  </div>
                  <span className="text-xs font-black text-[var(--text-primary)]">
                    Smart Interview AI
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-9 h-9 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-sm font-bold text-[var(--text-secondary)]"
                >
                  ✕
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all min-h-[48px] ${
                        isActive
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Drawer Footer & Actions */}
            <div className="space-y-4 pt-6 border-t border-[var(--border)]">
              <Link
                href="/"
                className="btn-primary w-full py-3.5 text-sm font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 min-h-[48px]"
              >
                <span>Start AI Interview ➔</span>
              </Link>
              
              <div className="text-center">
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  © {new Date().getFullYear()} ASHVANCE TECH
                </p>
                <p className="text-[10px] text-[var(--secondary)] font-semibold mt-0.5">
                  Intelligent Hiring. Smarter Interviews.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}
    </header>
  );
}
