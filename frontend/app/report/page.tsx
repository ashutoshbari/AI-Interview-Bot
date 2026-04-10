'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getReport, getPdfUrl, Report } from '@/lib/api';

const REC_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  'Strong Hire': { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: '🚀' },
  'Hire': { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: '✅' },
  'No Hire': { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: '❌' },
};

function ScoreArc({ score, label }: { score: number; label: string }) {
  const clamp = Math.max(0, Math.min(100, score));
  const color = clamp >= 75 ? '#22c55e' : clamp >= 50 ? '#f59e0b' : '#ef4444';
  const dashArray = 220;
  const dashOffset = dashArray - (dashArray * clamp) / 100;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="90" height="90" viewBox="0 0 90 90" className="-rotate-90">
        <circle cx="45" cy="45" r="35" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeDasharray={dashArray} />
        <circle
          cx="45" cy="45" r="35" fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={dashArray} strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <span className="text-white font-bold text-xl -mt-16" style={{ color }}>{clamp.toFixed(0)}</span>
      <span className="text-white/50 text-xs text-center mt-12">{label}</span>
    </div>
  );
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
        setError(e?.response?.data?.detail || 'Failed to load report.');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [candidateId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500/20 border border-primary-400/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary-300 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="60" strokeDashoffset="20" />
            </svg>
          </div>
          <p className="text-white/70 text-sm">Analyzing performance data...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center">
          <p className="text-red-400 mb-4">{error || 'Report not available.'}</p>
          <button onClick={() => router.push('/')} className="btn-primary">Start New Interview</button>
        </div>
      </div>
    );
  }

  const recInfo = REC_CONFIG[report.recommendation] || REC_CONFIG['No Hire'];

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500/20 border border-primary-500/30 mb-4">
            <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Interview Report</h1>
          <p className="text-white/50 mt-1">{candidateName}</p>
        </div>

        {/* Score Cards */}
        <div className="card">
          <h2 className="text-white font-semibold text-lg mb-6 text-center">Performance Scores</h2>
          <div className="flex justify-around flex-wrap gap-6">
            <ScoreArc score={report.technical_score * 10} label="Technical" />
            <ScoreArc score={report.problem_solving_score * 10} label="Problem Solving" />
            <ScoreArc score={report.communication_score * 10} label="Communication" />
          </div>
        </div>

        {/* Hiring Recommendation */}
        <div className={`card border ${recInfo.bg} text-center py-8`}>
          <p className="text-white/50 text-xs uppercase font-bold tracking-widest mb-2">Hiring Recommendation</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl">{recInfo.icon}</span>
            <p className={`text-4xl font-bold ${recInfo.color}`}>{report.recommendation}</p>
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="text-white font-semibold mb-3">✅ Strengths</h2>
            <ul className="space-y-2">
              {(report.strengths || []).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <span className="text-green-400 mt-0.5 shrink-0">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h2 className="text-white font-semibold mb-3">⚠️ Areas for Improvement</h2>
            <ul className="space-y-2">
              {(report.weaknesses || []).map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Improvement Plan */}
        <div className="card">
          <h2 className="text-white font-semibold mb-4">📈 Recommended Action Plan</h2>
          <div className="space-y-3">
            {(report.improvement_plan || []).map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500/20 text-primary-300 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <a
            href={getPdfUrl(candidateId)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex-1 text-center py-3 rounded-xl"
          >
            ⬇️ Download PDF Report
          </a>
          <button
            onClick={() => router.push('/')}
            className="btn-secondary flex-1 text-center py-3"
          >
            Start New Interview
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
          <span className="w-3 h-3 rounded-full bg-primary-400 dot-1" />
          <span className="w-3 h-3 rounded-full bg-primary-400 dot-2" />
          <span className="w-3 h-3 rounded-full bg-primary-400 dot-3" />
        </div>
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
