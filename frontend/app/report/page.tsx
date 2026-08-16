'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getReport, getPdfUrl, Report } from '@/lib/api';

const REC_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; text: string }> = {
  'Strong Hire': { 
    color: 'text-emerald-400', 
    bg: 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20', 
    border: 'border-emerald-500/40', 
    icon: '🚀',
    text: 'Outstanding performance across technical depth, architecture, and communication.'
  },
  'Hire': { 
    color: 'text-blue-400', 
    bg: 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20', 
    border: 'border-blue-500/40', 
    icon: '✅',
    text: 'Solid technical competence and clear problem-solving ability.'
  },
  'No Hire': { 
    color: 'text-red-400', 
    bg: 'bg-gradient-to-r from-red-500/20 to-pink-500/20', 
    border: 'border-red-500/40', 
    icon: '⚠️',
    text: 'Further preparation required in core technical concepts and system design.'
  },
};

function ScoreArc({ score, label, color = '#6366f1' }: { score: number; label: string; color?: string }) {
  const clamp = Math.max(0, Math.min(100, score || 0));
  const dashArray = 220;
  const dashOffset = dashArray - (dashArray * clamp) / 100;

  return (
    <div className="flex flex-col items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-primary-400/40 transition-colors">
      <div className="relative flex items-center justify-center">
        <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
          <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="38" fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={dashArray} strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black font-mono text-white leading-none">{clamp.toFixed(0)}</span>
          <span className="text-[10px] text-white/40 font-mono">/100</span>
        </div>
      </div>
      <span className="text-white/80 font-semibold text-xs text-center mt-1">{label}</span>
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
    if (!candidateId) { router.push('/'); return; }
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
  }, [candidateId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center animate-fade-in glass-card p-10 max-w-sm w-full">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-500/20 border border-primary-400/30 flex items-center justify-center text-primary-300">
            <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="60" strokeDashoffset="20" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Synthesizing Scorecard</h2>
          <p className="text-white/50 text-xs">Computing multidimensional technical breakdown...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card max-w-md w-full text-center p-8">
          <p className="text-red-400 font-semibold mb-6">{error || 'Report not available.'}</p>
          <button onClick={() => router.push('/')} className="btn-primary w-full py-3.5">
            ← Start New Interview
          </button>
        </div>
      </div>
    );
  }

  const recKey = report.recommendation || 'Hire';
  const recInfo = REC_CONFIG[recKey] || REC_CONFIG['Hire'];

  const overallScore = Math.round(
    ((report.technical_score || 0) + (report.problem_solving_score || 0) + (report.communication_score || 0)) / 3
  );

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-10 relative overflow-hidden">
      
      {/* Background Decorative Aura */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto space-y-8 relative z-10 animate-fade-in">
        
        {/* Header Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glow-badge text-xs font-bold text-primary-200 mb-2">
            <span>🏆 Official Candidate Evaluation Report</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Interview Scorecard for <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-400">{candidateName}</span>
          </h1>
          <p className="text-white/50 text-sm">
            AI-generated technical assessment with automated proctoring analytics.
          </p>
        </div>

        {/* Hiring Recommendation Banner */}
        <div className={`rounded-3xl p-6 sm:p-8 border ${recInfo.bg} ${recInfo.border} shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-6`}>
          <div className="flex items-center gap-5">
            <div className="text-5xl">{recInfo.icon}</div>
            <div>
              <p className="text-xs uppercase font-bold text-white/50 tracking-wider">Hiring Verdict</p>
              <h2 className={`text-3xl font-black ${recInfo.color}`}>{recKey}</h2>
              <p className="text-white/70 text-xs sm:text-sm mt-1 max-w-md">{recInfo.text}</p>
            </div>
          </div>

          <div className="text-center sm:text-right shrink-0">
            <span className="text-xs uppercase font-mono text-white/40 block mb-1">Composite Score</span>
            <span className="text-5xl font-black font-mono text-white">{overallScore}</span>
            <span className="text-white/40 text-sm font-mono">/100</span>
          </div>
        </div>

        {/* Core Scores Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ScoreArc score={report.technical_score} label="Technical Depth & Architecture" color="#06b6d4" />
          <ScoreArc score={report.problem_solving_score} label="Problem Solving & Logic" color="#a855f7" />
          <ScoreArc score={report.communication_score} label="Clarity & Communication" color="#10b981" />
        </div>

        {/* Strengths & Growth Areas Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Key Strengths */}
          <div className="glass-card p-6 border border-emerald-500/20">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-xl">🌟</span>
              <h3 className="text-lg font-bold text-white">Demonstrated Strengths</h3>
            </div>
            <div className="space-y-2.5">
              {report.strengths?.length ? (
                report.strengths.map((str, i) => (
                  <div key={i} className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                    <span className="text-emerald-400 font-bold text-sm">✓</span>
                    <p className="text-emerald-100 text-xs leading-relaxed">{formatItem(str)}</p>
                  </div>
                ))
              ) : (
                <p className="text-white/40 text-xs">No specific strengths recorded.</p>
              )}
            </div>
          </div>

          {/* Growth & Improvement Areas */}
          <div className="glass-card p-6 border border-amber-500/20">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-xl">🎯</span>
              <h3 className="text-lg font-bold text-white">Areas for Improvement</h3>
            </div>
            <div className="space-y-2.5">
              {report.weaknesses?.length ? (
                report.weaknesses.map((wk, i) => (
                  <div key={i} className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    <span className="text-amber-400 font-bold text-sm">➔</span>
                    <p className="text-amber-100 text-xs leading-relaxed">{formatItem(wk)}</p>
                  </div>
                ))
              ) : (
                <p className="text-white/40 text-xs">No critical gaps identified.</p>
              )}
            </div>
          </div>
        </div>

        {/* Improvement & Upskilling Plan */}
        {((report.improvement_plan?.length ?? 0) > 0 || (report.upskilling_plan?.length ?? 0) > 0) && (
          <div className="glass-card p-6 sm:p-8 border border-white/15">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-xl">📚</span>
              <h3 className="text-lg font-bold text-white">Personalized Upskilling Roadmap</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(report.improvement_plan || report.upskilling_plan || []).map((step, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start gap-3">
                  <span className="font-mono text-xs font-black text-primary-400 bg-primary-500/10 px-2 py-1 rounded-lg">
                    0{idx + 1}
                  </span>
                  <p className="text-white/80 text-xs leading-relaxed">{formatItem(step)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <a
            href={getPdfUrl(candidateId)}
            target="_blank"
            rel="noreferrer"
            className="btn-primary w-full sm:w-auto px-8 py-4 text-base font-bold shadow-xl shadow-primary-500/25 flex items-center justify-center gap-2.5"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Download Official PDF Scorecard</span>
          </a>

          <button
            onClick={() => router.push('/')}
            className="btn-secondary w-full sm:w-auto px-8 py-4 text-base font-bold flex items-center justify-center gap-2"
          >
            <span>🔄 Start New Candidate Interview</span>
          </button>
        </div>

      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex gap-2">
          <span className="w-3 h-3 rounded-full bg-primary-400 animate-bounce" />
          <span className="w-3 h-3 rounded-full bg-primary-400 animate-bounce [animation-delay:0.2s]" />
          <span className="w-3 h-3 rounded-full bg-primary-400 animate-bounce [animation-delay:0.4s]" />
        </div>
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
