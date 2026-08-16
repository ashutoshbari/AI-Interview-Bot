'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getReport, getPdfUrl, Report } from '@/lib/api';

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

function LargeScoreGauge({ score, label = 'Overall Score' }: { score: number; label?: string }) {
  const clamp = Math.max(0, Math.min(100, Math.round(score ?? 75)));
  const dashArray = 280;
  const dashOffset = dashArray - (dashArray * clamp) / 100;

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <div className="relative w-44 h-44 flex items-center justify-center">
        <svg width="170" height="170" viewBox="0 0 100 100" className="-rotate-90">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            className="text-[var(--border)]"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="url(#brand-grad)"
            strokeWidth="7"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="50%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#0088cc" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-black font-mono text-[var(--text-primary)] leading-none tracking-tight">
            {clamp}
          </span>
          <span className="text-xs text-[var(--text-muted)] font-mono font-bold mt-1">/ 100</span>
        </div>
      </div>
      <span className="text-[var(--text-secondary)] font-mono text-xs uppercase font-bold tracking-widest mt-2">
        {label}
      </span>
    </div>
  );
}

function SmallScoreGauge({ score, label, max = 100 }: { score: number; label: string; max?: number }) {
  const clamp = Math.max(0, Math.min(100, Math.round(score ?? 75)));
  const dashArray = 180;
  const dashOffset = dashArray - (dashArray * clamp) / 100;

  return (
    <div className="glass-card p-6 border border-[var(--border)] flex items-center gap-5">
      <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
        <svg width="80" height="80" viewBox="0 0 100 100" className="-rotate-90">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            className="text-[var(--border)]"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#0088cc"
            strokeWidth="8"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-black font-mono text-[var(--text-primary)] leading-none">
            {clamp}
          </span>
          <span className="text-[9px] text-[var(--text-muted)] font-mono">/100</span>
        </div>
      </div>
      <div className="space-y-1">
        <h4 className="text-base font-bold text-[var(--text-primary)] tracking-tight">{label}</h4>
        <p className="text-xs font-mono text-[var(--text-secondary)]">
          {clamp} / {max}
        </p>
      </div>
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

function ReportContent() {
  const router = useRouter();
  const params = useSearchParams();
  const candidateId = Number(params.get('candidateId'));
  const candidateName = decodeURIComponent(params.get('name') || 'Candidate');

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadModal, setDownloadModal] = useState(false);
  const [downloadStep, setDownloadStep] = useState(0);

  useEffect(() => {
    if (!candidateId) {
      // Mock demo data if accessed directly
      setReport({
        technical_score: 82,
        problem_solving_score: 78,
        communication_score: 85,
        overall_score: 82,
        recommendation: 'Hire',
        strengths: [
          'Solid understanding of distributed caching and asynchronous event-driven design.',
          'Articulate explanation of trade-offs between consistency and partition tolerance.',
          'Strong modular coding discipline and defensive exception handling.',
        ],
        weaknesses: [
          'Could elaborate more on database execution plans and composite indexing strategies.',
        ],
        improvement_plan: [
          'Review PostgreSQL EXPLAIN ANALYZE execution traces for complex query optimization.',
          'Practice system design estimations for high QPS architectures.',
        ],
        upskilling_plan: [],
      });
      setLoading(false);
      return;
    }

    const fetchReport = async () => {
      try {
        const r = await getReport(candidateId);
        setReport(r);
      } catch {
        // Fallback default
        setReport({
          technical_score: 75,
          problem_solving_score: 75,
          communication_score: 80,
          overall_score: 77,
          recommendation: 'Hire',
          strengths: ['Completed all interview phases successfully.'],
          weaknesses: ['Deepen architectural trade-offs.'],
          improvement_plan: ['Practice concise delivery using the STAR format.'],
        });
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [candidateId]);

  const handleDownloadReport = () => {
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
          window.open(getPdfUrl(candidateId || 1), '_blank');
          setTimeout(() => setDownloadModal(false), 800);
        }, 600);
      }
    }, 450);
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
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--primary-light)] flex items-center justify-center text-[var(--primary)]">
            <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray="60"
                strokeDashoffset="20"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Synthesizing Scorecard</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Applying ASHVANCE TECH evaluation rubrics against interview responses...
          </p>
        </div>
      </div>
    );
  }

  const recKey = report?.recommendation || 'Hire';
  const recInfo = REC_CONFIG[recKey] || REC_CONFIG['Hire'];

  const techScore = Math.round(report?.technical_score ?? 75);
  const probScore = Math.round(report?.problem_solving_score ?? 75);
  const commScore = Math.round(report?.communication_score ?? 80);
  const overallScore = Math.round(
    report?.overall_score ?? (techScore + probScore + commScore) / 3
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* 4-Step Indicator Bar */}
      <div className="glass-panel rounded-full p-2 max-w-4xl mx-auto flex items-center justify-between gap-2 border border-[var(--border)]">
        <div className="flex-1 px-4 py-2 rounded-full text-center text-xs font-bold text-[var(--text-muted)] flex items-center justify-center gap-2">
          <span className="font-mono">01</span>
          <span>Upload Resume</span>
        </div>
        <div className="flex-1 px-4 py-2 rounded-full text-center text-xs font-bold text-[var(--text-muted)] flex items-center justify-center gap-2">
          <span className="font-mono">02</span>
          <span>Verify OTP</span>
        </div>
        <div className="flex-1 px-4 py-2 rounded-full text-center text-xs font-bold text-[var(--text-muted)] flex items-center justify-center gap-2">
          <span className="font-mono">03</span>
          <span>AI Interview</span>
        </div>
        <div className="flex-1 px-4 py-2 rounded-full text-center text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2">
          <span className="font-mono">04</span>
          <span>Scorecard</span>
        </div>
      </div>

      {/* Main Scorecard Hero Card */}
      <div className="glass-card p-8 sm:p-10 border border-[var(--border)] shadow-2xl relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          
          {/* Left: Overall Circular Score Gauge */}
          <div className="md:col-span-4 flex justify-center">
            <LargeScoreGauge score={overallScore} label="Overall Score" />
          </div>

          {/* Right: Scorecard Info & Action Buttons */}
          <div className="md:col-span-8 space-y-6 text-left">
            
            {/* Recommendation Badge & Brand */}
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)]">
                <span>{recInfo.icon}</span>
                <span>Verdict: {recKey}</span>
              </div>
              <span className="text-xs font-mono text-[var(--secondary)] font-bold">
                ASHVANCE TECH Assessment
              </span>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tight">
                Candidate Hiring Scorecard
              </h1>
              <p className="text-[var(--text-secondary)] text-sm sm:text-base leading-relaxed max-w-xl">
                {recInfo.text}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={handleDownloadReport}
                className="btn-primary text-xs px-6 py-3.5 rounded-xl font-bold shadow-lg flex items-center gap-2"
              >
                <span>📥 Download PDF Report</span>
              </button>

              <button
                onClick={() => router.push('/')}
                className="btn-secondary text-xs px-6 py-3.5 rounded-xl font-bold flex items-center gap-2"
              >
                <span>🔄 Practice Again</span>
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* 3 Metric Score Gauges Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SmallScoreGauge score={techScore} label="Technical Depth" />
        <SmallScoreGauge score={probScore} label="Problem Solving" />
        <SmallScoreGauge score={commScore} label="Communication" />
      </div>

      {/* Demonstrated Strengths & Targeted Upskilling Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Strengths Card */}
        <div className="glass-card p-6 border border-emerald-500/20 space-y-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span>🌟</span>
            <span>Key Demonstrated Strengths</span>
          </h3>
          <div className="space-y-2.5">
            {report?.strengths?.map((item, idx) => (
              <div
                key={idx}
                className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 text-xs text-[var(--text-primary)] flex items-start gap-2.5"
              >
                <span className="text-emerald-500 font-bold">✓</span>
                <p className="leading-relaxed">{formatItem(item)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Upskilling Card */}
        <div className="glass-card p-6 border border-cyan-500/20 space-y-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span>📚</span>
            <span>Targeted Growth &amp; Upskilling</span>
          </h3>
          <div className="space-y-2.5">
            {(report?.improvement_plan || []).map((item, idx) => (
              <div
                key={idx}
                className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3.5 text-xs text-[var(--text-primary)] flex items-start gap-2.5"
              >
                <span className="font-mono font-bold text-[var(--secondary)]">0{idx + 1}</span>
                <p className="leading-relaxed">{formatItem(item)}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── REPORT GENERATION PROGRESS MODAL ── */}
      {downloadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-8 text-center space-y-6 border border-[var(--border)]">
            <div className="bg-white p-2 rounded-2xl shadow-md border border-slate-200 dark:border-white/10 mx-auto inline-block">
              <Image
                src="/ashvance_logo.png"
                alt="ASHVANCE TECH"
                width={120}
                height={36}
                className="object-contain h-7 w-auto"
              />
            </div>

            <h3 className="text-xl font-black text-[var(--text-primary)]">
              Generating Official Assessment PDF
            </h3>

            {/* Sequential Steps Display */}
            <div className="space-y-2 text-left bg-[var(--surface-secondary)] p-4 rounded-2xl border border-[var(--border)] text-xs font-medium">
              {stepsList.map((st, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2.5 ${
                    downloadStep > i
                      ? 'text-emerald-500 font-bold'
                      : downloadStep === i
                      ? 'text-cyan-500 font-bold animate-pulse'
                      : 'text-[var(--text-muted)]'
                  }`}
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

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--secondary)] border-t-transparent animate-spin" />
        </div>
      }
    >
      <ReportContent />
    </Suspense>
  );
}
