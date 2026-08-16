'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full relative z-10 mt-auto border-t border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
        
        {/* Left: Brand Identity & Logo */}
        <div className="flex items-center gap-4">
          <div className="bg-white p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 flex items-center justify-center">
            <Image
              src="/ashvance_logo.png"
              alt="ASHVANCE TECH Logo"
              width={110}
              height={32}
              className="object-contain h-7 w-auto"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tight text-[var(--text-primary)]">
              ASHVANCE TECH
            </span>
            <span className="text-xs font-semibold text-[var(--secondary)]">
              Smart Interview AI
            </span>
          </div>
        </div>

        {/* Center: Tagline & Copyright */}
        <div className="text-center md:text-right space-y-1">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            Intelligent Hiring. Smarter Interviews.
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            © {new Date().getFullYear()} ASHVANCE TECH. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}
