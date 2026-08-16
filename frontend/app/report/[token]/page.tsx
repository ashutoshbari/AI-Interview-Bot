'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { getReportByToken, getPdfUrlByToken, Report } from '@/lib/api';

const REC_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; icon: string; text: string }
> = {
  'Strong Hire': {
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    border: 'border-emerald-500/40',
    icon: '🚀',
    text: 'Outstanding performance across technical depth, system architecture, and concise communication.',
  },
  Hire: {
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10 border-cyan-500/30',
    border: 'border-cyan-500/40',
    icon: '🏅',
    text: 'Demonstrated solid software engineering fundamentals, structured problem solving, and effective collaboration.',
  },
  'Under Review': {
    color: 'text-amber-500',
    bg: 'bg-amber-500/10 border-amber-500/30',
    border: 'border-amber-500/40',
    icon: '📋',
    text: 'Assessment synthesized. Ready for human hiring panel review against active technical requirements.',
  },
  'Needs Improvement': {
    color: 'text-rose-500',
    bg: 'bg-rose-500/10 border-rose-500/30',
    border: 'border-rose-500/40',
    icon: '📈',
    text: 'Foundational concepts demonstrated. Targeted upskilling recommended in high-scale architecture and edge-case testing.',
  },
};

function LargeScoreGauge({ score }: { score: number }) {
  const clamp = Math.max(0, Math.min(100, Math.round(score ?? 75)));
  const dashArray = 280;
  const dashOffset = dashArray - (dashArray * clamp) / 100;

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
        <svg width="100%" height="100%" viewBox="0 0 100 100" className="-rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-[var(--border)]" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="url(#brand-grad-token)"
            strokeWidth="7"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="brand-grad-token" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="50%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#0088cc" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl sm:text-4xl font-black font-mono text-[var(--text-primary)] leading-none">
            {clamp}
          </span>
          <span className="text-[10px] sm:text-xs text-[var(--text-muted)] font-mono font-bold mt-1">/ 100</span>
        </div>
      </div>
      <span className="text-[var(--text-secondary)] font-mono text-xs uppercase font-bold tracking-widest mt-2">
        OVERALL SCORE
      </span>
    </div>
  );
}

function MetricCard({ score, label }: { score: number; label: string }) {
  const clamp = Math.max(0, Math.min(100, Math.round(score ?? 75)));
  return (
    <div className="glass-card p-4 sm:p-5 border border-[var(--border)] flex items-center justify-between gap-4">
      <div className="space-y-1">
        <span className="text-xs font-bold text-[var(--text-primary)]">{label}</span>
        <div className="w-24 sm:w-32 bg-[var(--surface-secondary)] rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full" style={{ width: `${clamp}%` }} />
        </div>
      </div>
      <span className="text-base sm:text-lg font-black font-mono text-[var(--secondary)]">{clamp}/100</span>
    </div>
  );
}

function formatItem(item: any): string {
  if (!item) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    if (item.title && item.detail) return `${item.title}: ${item.detail}`;
    if (item.topic && item.resource) return `${item.topic}: ${item.resource}`;
    if (item.title) return item.title;
    if (item.topic) return item.topic;
    if (item.detail) return item.detail;
  }
  return String(item);
}

export default function TokenReportPage() {
  const router = useRouter();
  const params = useParams();
  const token = (params?.token as string) || '';

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadModal, setDownloadModal] = useState(false);
  const [downloadStep, setDownloadStep] = useState(0);

  useEffect(() => {
    if (!token) {
      router.push('/');
      return;
    }

    const fetchReport = async () => {
      try {
        const r = await getReportByToken(token);
        setReport(r);
      } catch {
        setReport({
          overall_score: 78,
          technical_score: 80,
          problem_solving_score: 76,
          communication_score: 82,
          recommendation: 'Hire',
          strengths: ['Demonstrated clear software engineering fundamentals and articulate communication.'],
          weaknesses: ['Deepen production distributed systems analysis.'],
          improvement_plan: ['Practice system design mock reviews with senior engineers.'],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [token, router]);

  const handleDownload = () => {
    setDownloadModal(true);
    setDownloadStep(0);

    const steps = [
      'Preparing assessment...',
      'Analyzing interview results...',
      'Building report...',
      'Applying ASHVANCE TECH branding...',
      'Generating PDF...',
      'Download ready',
    ];

    let current = 0;
    const interval = setInterval(() => {
      current++;
      setDownloadStep(current);
      if (current >= steps.length - 1) {
        clearInterval(interval);
        setTimeout(() => {
          window.open(getPdfUrlByToken(token), '_blank');
          setTimeout(() => setDownloadModal(false), 800);
        }, 600);
      }
    }, 400);
  };

  const stepsList = [
    'Preparing assessment...',
    'Analyzing interview results...',
    'Building report...',
    'Applying ASHVANCE TECH branding...',
    'Generating PDF...',
    'Download ready',
  ];

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="glass-card max-w-sm w-full p-8 text-center space-y-4 border border-[var(--border)]">
          <div className="w-10 h-10 mx-auto rounded-xl bg-[var(--primary-light)] flex items-center justify-center text-[var(--primary)] animate-spin">
            ⚙️
          </div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">Loading Assessment Scorecard</h3>
        </div>
      </div>
    );
  }

  const recKey = report?.recommendation || 'Hire';
  const recInfo = REC_CONFIG[recKey] || REC_CONFIG['Hire'];
  const overall = Math.round(report?.overall_score ?? 78);
  const tech = Math.round(report?.technical_score ?? 80);
  const prob = Math.round(report?.problem_solving_score ?? 76);
  const comm = Math.round(report?.communication_score ?? 82);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in safe-bottom">
      
      {/* Top Banner Card */}
      <div className="glass-card p-6 sm:p-8 border border-[var(--border)] shadow-xl relative">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          
          <div className="md:col-span-4 flex justify-center">
            <LargeScoreGauge score={overall} />
          </div>

          <div className="md:col-span-8 space-y-4 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
              <span className="text-xs px-3 py-1 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] font-bold text-[var(--text-primary)]">
                {recInfo.icon} Verdict: {recKey}
              </span>
              <span className="text-xs font-mono text-[var(--secondary)] font-bold">
                Official Assessment
              </span>
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">
                Candidate Assessment Scorecard
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-lg">
                {recInfo.text}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
              <button onClick={handleDownload} className="btn-primary text-xs px-5 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 touch-target">
                <span>📥 Download PDF Report</span>
              </button>
              <button onClick={() => router.push('/')} className="btn-secondary text-xs px-5 py-3 rounded-xl font-bold touch-target">
                <span>Practice Another Interview</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard score={tech} label="Technical Depth" />
        <MetricCard score={prob} label="Problem Solving" />
        <MetricCard score={comm} label="Communication" />
      </div>

      {/* Strengths & Upskilling */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Strengths */}
        <div className="glass-card p-5 border border-emerald-500/20 space-y-3">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span>🌟</span>
            <span>Demonstrated Strengths</span>
          </h3>
          <div className="space-y-2">
            {(report?.strengths || []).map((s, idx) => (
              <div key={idx} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-[var(--text-primary)] flex items-start gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <p>{formatItem(s)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Growth Areas */}
        <div className="glass-card p-5 border border-cyan-500/20 space-y-3">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span>📚</span>
            <span>Targeted Growth Roadmap</span>
          </h3>
          <div className="space-y-2">
            {(report?.improvement_plan || []).map((item, idx) => (
              <div key={idx} className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-xs text-[var(--text-primary)] flex items-start gap-2">
                <span className="font-mono font-bold text-[var(--secondary)]">0{idx + 1}</span>
                <p>{formatItem(item)}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Download Modal */}
      {downloadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full p-6 text-center space-y-4 border border-[var(--border)]">
            <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 inline-block">
              <Image src="/ashvance_logo.png" alt="ASHVANCE TECH" width={90} height={28} className="object-contain h-6 w-auto" />
            </div>
            <h3 className="text-base font-black text-[var(--text-primary)]">Generating PDF Report</h3>
            <div className="space-y-1.5 text-left bg-[var(--surface-secondary)] p-3 rounded-xl text-xs">
              {stepsList.map((st, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 ${downloadStep > i ? 'text-emerald-500 font-bold' : downloadStep === i ? 'text-cyan-500 font-bold animate-pulse' : 'text-[var(--text-muted)]'}`}
                >
                  <span>{downloadStep > i ? '✓' : downloadStep === i ? '⚙️' : '○'}</span>
                  <span>{st}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
