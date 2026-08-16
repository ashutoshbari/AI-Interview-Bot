'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { registerCandidate, sendOTP } from '@/lib/api';

const TARGET_POSITIONS = [
  'Software Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Data Scientist',
  'DevOps Engineer',
];

export default function RegistrationPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'form' | 'loading'>('form');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('Software Engineer');
  const [resume, setResume] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Uploading & analyzing resume...');
  const [loadingProgress, setLoadingProgress] = useState(0);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) newErrors.name = 'Full name is required';
    const digits = mobile.replace(/\D/g, '');
    if (digits.length < 10) newErrors.mobile = 'Enter a valid 10-digit mobile number';
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) newErrors.email = 'Enter a valid email address';
    if (!resume) newErrors.resume = 'Please upload your resume (PDF, DOC, or DOCX)';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(ext || '')) {
      setErrors(prev => ({ ...prev, resume: 'Only PDF, DOC, and DOCX files supported' }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, resume: 'File size must be under 10 MB' }));
      return;
    }
    setResume(file);
    setErrors(prev => { const e = { ...prev }; delete e.resume; return e; });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileChange(file);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;
    setIsSubmitting(true);
    setStep('loading');

    const messages = [
      'Parsing resume architecture & key technical achievements...',
      'Synthesizing customized interview question matrix...',
      'Generating candidate security PIN & OTP...',
      'Opening AI Neural Interviewer 2.0 studio...',
    ];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setLoadingMessage(messages[msgIdx]);
    }, 2200);

    const progInterval = setInterval(() => {
      setLoadingProgress(prev => Math.min(prev + 3, 94));
    }, 150);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('mobile', mobile.trim());
      formData.append('email', email.trim());
      formData.append('position', position);
      if (resume) formData.append('resume', resume);

      const candidate = await registerCandidate(formData);

      try {
        await sendOTP(candidate.id);
      } catch (err) {
        console.log('OTP trigger handled:', err);
      }

      setLoadingProgress(100);
      clearInterval(msgInterval);
      clearInterval(progInterval);

      setTimeout(() => {
        router.push(`/verify?candidateId=${candidate.id}&email=${encodeURIComponent(email.trim())}&name=${encodeURIComponent(name.trim())}`);
      }, 500);
    } catch (err: any) {
      clearInterval(msgInterval);
      clearInterval(progInterval);
      setIsSubmitting(false);
      setStep('form');
      setErrors({ global: err?.response?.data?.detail || err?.message || 'Registration failed. Please check network connection.' });
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 relative overflow-hidden">
        <div className="glass-card max-w-lg w-full p-8 sm:p-10 text-center space-y-6 animate-fade-in relative z-10 border border-purple-500/30">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-purple-600 to-cyan-400 p-0.5 shadow-2xl shadow-purple-500/40">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
              <svg className="w-10 h-10 text-cyan-300 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="60" strokeDashoffset="20" />
              </svg>
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight">Setting Up Your Interview Loop</h2>
            <p className="text-cyan-300 font-mono text-xs animate-pulse">{loadingMessage}</p>
          </div>

          <div className="space-y-2">
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-white/40">
              <span>INITIALIZING STUDIO</span>
              <span>{Math.round(loadingProgress)}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      
      {/* 2-Column Split Grid Matching Lovable UI Screenshot 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* Left Column: Headline, Description & Metrics */}
        <div className="lg:col-span-6 space-y-8 animate-fade-in">
          
          {/* Active Status Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono font-semibold text-white/80">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AI Neural Interviewer 2.0</span>
            <span className="text-white/40">• Active</span>
          </div>

          {/* Giant Hero Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Practice like it's the real <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-400">Google loop.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-white/70 text-base sm:text-lg leading-relaxed max-w-xl">
            Sit down with a senior AI interviewer who listens, adapts, and grades every answer. Upload your resume, verify your identity, and walk out with a hiring-grade scorecard in under 20 minutes.
          </p>

          {/* 3 Metric Stat Cards Grid */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-lg pt-2">
            
            {/* Metric 1 */}
            <div className="glass-panel p-4 rounded-2xl border border-white/10 text-center space-y-1">
              <span className="text-2xl sm:text-3xl font-black font-mono text-white block">6</span>
              <span className="text-[10px] font-mono font-bold tracking-widest text-white/40 uppercase block">
                ADAPTIVE STAGES
              </span>
            </div>

            {/* Metric 2 */}
            <div className="glass-panel p-4 rounded-2xl border border-white/10 text-center space-y-1">
              <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-300 block">&lt;2s</span>
              <span className="text-[10px] font-mono font-bold tracking-widest text-white/40 uppercase block">
                GRADE LATENCY
              </span>
            </div>

            {/* Metric 3 */}
            <div className="glass-panel p-4 rounded-2xl border border-white/10 text-center space-y-1">
              <span className="text-2xl sm:text-3xl font-black font-mono text-purple-300 block">100</span>
              <span className="text-[10px] font-mono font-bold tracking-widest text-white/40 uppercase block">
                POINT SCORECARD
              </span>
            </div>

          </div>

        </div>

        {/* Right Column: Candidate Registration Card */}
        <div className="lg:col-span-6 animate-fade-in">
          
          <div className="glass-card p-6 sm:p-8 border border-purple-500/20 shadow-2xl relative">
            
            {/* Card Header */}
            <div className="mb-6 space-y-1">
              <span className="text-[11px] font-mono font-bold tracking-widest text-cyan-400 uppercase block">
                START YOUR PRACTICE LOOP
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Candidate registration
              </h2>
            </div>

            {errors.global && (
              <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-3">
                <span className="text-lg">⚠️</span>
                <p>{errors.global}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Row 1: Full Name & Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold tracking-wider text-white/60 uppercase block">
                    FULL NAME *
                  </label>
                  <input
                    type="text"
                    placeholder="Ada Lovelace"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`input-field text-sm ${errors.name ? 'border-red-500' : ''}`}
                  />
                  {errors.name && <p className="text-red-400 text-[10px]">{errors.name}</p>}
                </div>

                {/* Mobile */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold tracking-wider text-white/60 uppercase block">
                    MOBILE *
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className={`input-field text-sm ${errors.mobile ? 'border-red-500' : ''}`}
                  />
                  {errors.mobile && <p className="text-red-400 text-[10px]">{errors.mobile}</p>}
                </div>

              </div>

              {/* Row 2: Email Address */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold tracking-wider text-white/60 uppercase block">
                  EMAIL *
                </label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`input-field text-sm ${errors.email ? 'border-red-500' : ''}`}
                />
                {errors.email && <p className="text-red-400 text-[10px]">{errors.email}</p>}
              </div>

              {/* Row 3: Target Position Pills & Select */}
              <div className="space-y-2 pt-1">
                <label className="text-[10px] font-mono font-bold tracking-wider text-white/60 uppercase block">
                  TARGET POSITION
                </label>

                {/* Quick Select Pills */}
                <div className="flex flex-wrap gap-2 pb-1">
                  {TARGET_POSITIONS.map((pos) => (
                    <button
                      type="button"
                      key={pos}
                      onClick={() => setPosition(pos)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        position === pos
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30 border border-purple-400/40'
                          : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="input-field text-sm font-semibold"
                  placeholder="Or enter custom position"
                />
              </div>

              {/* Row 4: Resume Drag & Drop Zone */}
              <div className="space-y-2 pt-1">
                <label className="text-[10px] font-mono font-bold tracking-wider text-white/60 uppercase block">
                  RESUME *
                </label>

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    dragOver
                      ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                      : resume
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : errors.resume
                      ? 'border-red-500/50 bg-red-500/5'
                      : 'border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                  />

                  {resume ? (
                    <div className="flex items-center justify-between bg-slate-900/90 p-3 rounded-xl border border-emerald-500/30">
                      <div className="flex items-center gap-3 text-left">
                        <span className="text-2xl">📄</span>
                        <div>
                          <p className="text-xs font-bold text-white truncate max-w-xs">{resume.name}</p>
                          <p className="text-[10px] font-mono text-emerald-400">
                            {(resume.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI Analysis
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setResume(null); }}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-10 h-10 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-cyan-300">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Drag &amp; drop your resume</p>
                        <p className="text-[10px] text-white/40 font-mono mt-0.5">PDF, DOC, DOCX up to 10MB</p>
                      </div>
                    </div>
                  )}
                </div>
                {errors.resume && <p className="text-red-400 text-[10px]">{errors.resume}</p>}
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-4 text-sm font-extrabold tracking-wide shadow-xl shadow-purple-500/30 flex items-center justify-center gap-2 rounded-xl mt-2"
              >
                <span>Start AI Practice Loop ➔</span>
              </button>

            </form>

          </div>

        </div>

      </div>

    </div>
  );
}
