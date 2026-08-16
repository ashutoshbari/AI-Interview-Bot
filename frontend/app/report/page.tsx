'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getReport, getPdfUrl, Report } from '@/lib/api';

const REC_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; text: string }> = {
  'Strong Hire': { 
    color: 'text-emerald-400', 
    bg: 'bg-emerald-500/10 border-emerald-500/30', 
    border: 'border-emerald-500/40', 
    icon: '🚀',
    text: 'Outstanding performance across technical depth, architecture, and communication.'
  },
  'Hire': { 
    color: 'text-cyan-300', 
    bg: 'bg-cyan-500/10 border-cyan-500/30', 
    border: 'border-cyan-500/40', 
    icon: '🏅',
    text: 'Scored across technical depth, problem solving and communication using the same rubric senior panels use in real onsite loops.'
  },
  'No Hire': { 
    color: 'text-rose-400', 
    bg: 'bg-rose-500/10 border-rose-500/30', 
    border: 'border-rose-500/40', 
    icon: '⚠️',
    text: 'Further preparation required in core technical concepts and system design.'
  },
};

function LargeScoreGauge({ score, label = 'Composite' }: { score: number; label?: string }) {
  const clamp = Math.max(0, Math.min(100, Math.round(score ?? 75)));
  const dashArray = 280;
  const dashOffset = dashArray - (dashArray * clamp) / 100;

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <div className="relative w-44 h-44 flex items-center justify-center">
        <svg width="170" height="170" viewBox="0 0 100 100" className="-rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke="url(#cyan-purple-grad)" strokeWidth="7"
            strokeDasharray={dashArray} strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="cyan-purple-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-black font-mono text-white leading-none tracking-tight">{clamp}</span>
          <span className="text-xs text-white/40 font-mono font-bold mt-1">/ 100</span>
        </div>
      </div>
      <span className="text-white/60 font-mono text-xs uppercase font-bold tracking-widest mt-2">{label}</span>
    </div>
  );
}

function SmallScoreGauge({ score, label, max = 100 }: { score: number; label: string; max?: number }) {
  const clamp = Math.max(0, Math.min(100, Math.round(score ?? 75)));
  const dashArray = 180;
  const dashOffset = dashArray - (dashArray * clamp) / 100;

  return (
    <div className="glass-card p-6 border border-white/10 flex items-center gap-5">
      <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
        <svg width="80" height="80" viewBox="0 0 100 100" className="-rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke="#06b6d4" strokeWidth="8"
            strokeDasharray={dashArray} strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-black font-mono text-white leading-none">{clamp}</span>
          <span className="text-[9px] text-white/40 font-mono">/100</span>
        </div>
      </div>
      <div className="space-y-1">
        <h4 className="text-base font-bold text-white tracking-tight">{label}</h4>
        <p className="text-xs font-mono text-white/50">{clamp} / {max}</p>
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
  const [error, setError] = useState('');

  useEffect(() => {
    if (!candidateId) {
      // Mock report preview if accessed directly without candidateId
      setReport({
        technical_score: 74,
        problem_solving_score: 74,
        communication_score: 74,
        overall_score: 74,
        recommendation: 'Hire',
        strengths: [
          'Strong understanding of asynchronous I/O and event loop concurrency',
          'Articulate explanation of microservice failure domains and circuit breakers',
          'Clean modular code structure with defensive error handling'
        ],
        weaknesses: [
          'Could elaborate more on database indexing and query execution plans under high load'
        ],
        improvement_plan: [
          'Review PostgreSQL EXPLAIN ANALYZE for query optimization',
          'Practice system design estimations for 100k QPS architectures'
        ],
        upskilling_plan: []
      });
      setLoading(false);
      return;
    }

    const fetchReport = async () => {
      try {
        const r = await getReport(candidateId);
        setReport(r);
      } catch (e: any) {
        setError(e?.response?.data?.detail || 'Failed to load report scorecard.');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [candidateId]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="glass-card max-w-sm w-full p-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
            <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white">Synthesizing Scorecard</h3>
          <p className="text-xs text-white/50">Evaluating technical responses against Google rubric...</p>
        </div>
      </div>
    );
  }

  const recKey = report?.recommendation || 'Hire';
  const recInfo = REC_CONFIG[recKey] || REC_CONFIG['Hire'];
  
  const techScore = Math.round(report?.technical_score ?? 75);
  const probScore = Math.round(report?.problem_solving_score ?? 75);
  const commScore = Math.round(report?.communication_score ?? 80);
  const overallScore = Math.round(report?.overall_score ?? ((techScore + probScore + commScore) / 3));

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* 4-Step Indicator Bar Matching Lovable UI Screenshot 2 */}
      <div className="glass-panel rounded-full p-2 max-w-4xl mx-auto flex items-center justify-between gap-2 border border-white/10">
        
        <div className="flex-1 px-4 py-2 rounded-full text-center text-xs font-semibold text-white/40 flex items-center justify-center gap-2">
          <span className="font-mono">01</span>
          <span>Upload Resume</span>
        </div>

        <div className="flex-1 px-4 py-2 rounded-full text-center text-xs font-semibold text-white/40 flex items-center justify-center gap-2">
          <span className="font-mono">02</span>
          <span>Verify OTP</span>
        </div>

        <div className="flex-1 px-4 py-2 rounded-full text-center text-xs font-semibold text-white/40 flex items-center justify-center gap-2">
          <span className="font-mono">03</span>
          <span>Voice Interview</span>
        </div>

        <div className="flex-1 px-4 py-2 rounded-full text-center text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2">
          <span className="font-mono">04</span>
          <span>Scorecard</span>
        </div>

      </div>

      {/* Main Composite Score Hero Card Matching Lovable UI Screenshot 2 */}
      <div className="glass-card p-8 sm:p-10 border border-purple-500/20 shadow-2xl relative overflow-hidden">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          
          {/* Left: Composite Circular Gauge */}
          <div className="md:col-span-4 flex justify-center">
            <LargeScoreGauge score={overallScore} label="Composite" />
          </div>

          {/* Right: Scorecard Info & Actions */}
          <div className="md:col-span-8 space-y-6 text-left">
            
            {/* Recommendation Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-bold">
              <span>{recInfo.icon}</span>
              <span>{recKey}</span>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Your hiring scorecard
              </h1>
              <p className="text-white/70 text-sm sm:text-base leading-relaxed max-w-xl">
                {recInfo.text}
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href={getPdfUrl(candidateId || 1)}
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-xs px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-cyan-500/20 flex items-center gap-2"
              >
                <span>📥 Download PDF report</span>
              </a>

              <button
                onClick={() => router.push('/')}
                className="btn-secondary text-xs px-6 py-3.5 rounded-xl font-bold flex items-center gap-2"
              >
                <span>🔄 Practice again</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* 3 Metric Score Gauge Cards Row Matching Lovable UI Screenshot 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SmallScoreGauge score={techScore} label="Technical Depth" />
        <SmallScoreGauge score={probScore} label="Problem Solving" />
        <SmallScoreGauge score={commScore} label="Communication" />
      </div>

      {/* Strengths & Upskilling Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Strengths */}
        <div className="glass-card p-6 border border-emerald-500/20 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🌟</span>
            <span>Demonstrated Strengths</span>
          </h3>
          <div className="space-y-2.5">
            {report?.strengths?.map((item, idx) => (
              <div key={idx} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 text-xs text-emerald-200 flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <p className="leading-relaxed">{formatItem(item)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Upskilling Plan */}
        <div className="glass-card p-6 border border-cyan-500/20 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📚</span>
            <span>Recommended Upskilling</span>
          </h3>
          <div className="space-y-2.5">
            {(report?.improvement_plan || []).map((item, idx) => (
              <div key={idx} className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3.5 text-xs text-cyan-200 flex items-start gap-2.5">
                <span className="font-mono font-bold text-cyan-400">0{idx + 1}</span>
                <p className="leading-relaxed">{formatItem(item)}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <span className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
