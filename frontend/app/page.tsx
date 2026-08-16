'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { registerCandidate, sendOTP } from '@/lib/api';

const TARGET_POSITIONS = [
  'Software Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Engineer',
  'Data Scientist',
  'DevOps & Cloud Engineer',
];

export default function LandingAndRegistrationPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<'form' | 'loading'>('form');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('Software Engineer');
  const [resume, setResume] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressStep, setProgressStep] = useState(0);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) {
      newErrors.name = 'Full name is required (at least 2 characters)';
    }

    // Indian mobile number validation (10 digits starting 6-9, optional +91 prefix)
    const mobileClean = mobile.trim().replace(/[\s-]/g, '');
    const mobileDigits = mobileClean.replace(/^(\+91|91)/, '').replace(/\D/g, '');
    if (mobileDigits.length !== 10 || !['6', '7', '8', '9'].includes(mobileDigits[0])) {
      newErrors.mobile = 'Enter a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9)';
    }

    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      newErrors.email = 'Enter a valid corporate or personal email address';
    }

    if (!resume) {
      newErrors.resume = 'Please upload your resume (PDF, DOC, or DOCX up to 10MB)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(ext || '')) {
      setErrors((prev) => ({ ...prev, resume: 'Only PDF, DOC, and DOCX formats are supported' }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, resume: 'File size exceeds maximum limit of 10 MB' }));
      return;
    }
    setResume(file);
    setErrors((prev) => {
      const e = { ...prev };
      delete e.resume;
      return e;
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileChange(file);
  }, []);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    setStep('loading');
    setProgressStep(1);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('mobile', mobile.trim());
      formData.append('email', email.trim());
      formData.append('position', position.trim() || 'Software Engineer');
      if (resume) formData.append('resume', resume);

      // Step 1 -> 2: Uploading & validating candidate
      const candidate = await registerCandidate(formData);
      setProgressStep(2);

      // Step 3: Triggering OTP verification
      try {
        await sendOTP(candidate.id);
        setProgressStep(3);
      } catch (err) {
        console.log('OTP trigger handled in background:', err);
      }

      setProgressStep(4);

      setTimeout(() => {
        router.push(
          `/verify?candidateId=${candidate.id}&email=${encodeURIComponent(
            email.trim()
          )}&name=${encodeURIComponent(name.trim())}`
        );
      }, 700);
    } catch (err: any) {
      setIsSubmitting(false);
      setStep('form');
      setErrors({
        global:
          err?.response?.data?.detail ||
          err?.message ||
          'Registration encountered a network issue. Please retry.',
      });
    }
  };

  const feedbackMessages = [
    'Validating candidate details...',
    'Resume received & parsing background profile...',
    'Identity verification initialized...',
    'Sending OTP security PIN & opening studio...',
  ];

  if (step === 'loading') {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="glass-card max-w-lg w-full p-8 sm:p-10 text-center space-y-6 animate-fade-in border border-[var(--border)]">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-purple-600 to-cyan-400 p-0.5 shadow-2xl shadow-purple-500/30">
            <div className="w-full h-full bg-[var(--surface-card)] rounded-[22px] flex items-center justify-center">
              <svg className="w-10 h-10 text-[var(--accent-cyan)] animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeDasharray="60"
                  strokeDashoffset="20"
                />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold tracking-widest text-[var(--secondary)] uppercase block">
              ASHVANCE TECH • SMART INTERVIEW AI
            </span>
            <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
              Initializing Interview Studio
            </h2>
          </div>

          {/* Sequential Step Feedback */}
          <div className="bg-[var(--surface-secondary)] p-4 rounded-2xl border border-[var(--border)] text-left space-y-2.5 text-xs font-medium">
            <div className={`flex items-center gap-2.5 ${progressStep >= 1 ? 'text-emerald-500 font-bold' : 'text-[var(--text-muted)]'}`}>
              <span>{progressStep >= 1 ? '✓' : '○'}</span>
              <span>Candidate details validated</span>
            </div>
            <div className={`flex items-center gap-2.5 ${progressStep >= 2 ? 'text-emerald-500 font-bold' : 'text-[var(--text-muted)]'}`}>
              <span>{progressStep >= 2 ? '✓' : '○'}</span>
              <span>Resume profile received & synthesized</span>
            </div>
            <div className={`flex items-center gap-2.5 ${progressStep >= 3 ? 'text-emerald-500 font-bold' : 'text-[var(--text-muted)]'}`}>
              <span>{progressStep >= 3 ? '✓' : '○'}</span>
              <span>Verification security token generated</span>
            </div>
            <div className={`flex items-center gap-2.5 ${progressStep >= 4 ? 'text-cyan-500 font-bold' : 'text-[var(--text-muted)]'}`}>
              <span>{progressStep >= 4 ? '📨' : '○'}</span>
              <span>Dispatching OTP verification code</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-14 space-y-16">
      
      {/* ── HERO & REGISTRATION 2-COLUMN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* Left Column: Brand Hero */}
        <div className="lg:col-span-6 space-y-8 animate-fade-in">
          
          {/* Official Brand Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-mono font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[var(--text-primary)]">ASHVANCE TECH</span>
            <span className="text-[var(--text-muted)]">•</span>
            <span className="text-[var(--secondary)]">Smart Interview AI</span>
          </div>

          {/* Hero Headlines */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-[var(--text-primary)]">
              Interview Smarter.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-400">
                Hire Better.
              </span>
            </h1>

            <p className="text-[var(--text-secondary)] text-base sm:text-lg leading-relaxed max-w-xl">
              AI-powered resume analysis, adaptive technical interviews, real-time conversational voice interaction, and intelligent candidate assessment.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={scrollToForm}
              className="btn-primary text-sm px-7 py-4 rounded-xl font-extrabold shadow-xl flex items-center gap-2.5"
            >
              <span>Start AI Interview</span>
              <span>➔</span>
            </button>

            <button
              onClick={scrollToForm}
              className="btn-secondary text-sm px-6 py-4 rounded-xl font-bold flex items-center gap-2"
            >
              <span>Explore Platform</span>
            </button>
          </div>

          {/* 3 Metric Stat Cards */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-lg pt-4">
            <div className="glass-panel p-4 rounded-2xl border border-[var(--border)] text-center space-y-1">
              <span className="text-2xl sm:text-3xl font-black font-mono text-[var(--text-primary)] block">6</span>
              <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--text-muted)] uppercase block">
                ADAPTIVE STAGES
              </span>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-[var(--border)] text-center space-y-1">
              <span className="text-2xl sm:text-3xl font-black font-mono text-[var(--secondary)] block">&lt;2s</span>
              <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--text-muted)] uppercase block">
                EVALUATION SPEED
              </span>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-[var(--border)] text-center space-y-1">
              <span className="text-2xl sm:text-3xl font-black font-mono text-[var(--primary)] block">100</span>
              <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--text-muted)] uppercase block">
                POINT SCORECARD
              </span>
            </div>
          </div>

        </div>

        {/* Right Column: Registration Card */}
        <div ref={formRef} className="lg:col-span-6 animate-fade-in">
          
          <div className="glass-card p-6 sm:p-8 border border-[var(--border)] shadow-2xl relative">
            
            {/* Header Badge & Brand */}
            <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border)]">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--secondary)] uppercase block">
                  CANDIDATE ONBOARDING
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                  Start Your AI Interview
                </h2>
              </div>

              {/* Logo container */}
              <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-200 dark:border-white/10 shrink-0">
                <Image
                  src="/ashvance_logo.png"
                  alt="ASHVANCE TECH"
                  width={90}
                  height={28}
                  className="object-contain h-6 w-auto"
                />
              </div>
            </div>

            {errors.global && (
              <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-3">
                <span className="text-lg">⚠️</span>
                <p className="font-medium">{errors.global}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Row 1: Full Name & Indian Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold tracking-wider text-[var(--text-secondary)] uppercase block">
                    FULL NAME *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ashutosh"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`input-field text-sm ${errors.name ? 'border-red-500' : ''}`}
                  />
                  {errors.name && <p className="text-red-400 text-[10px] font-semibold">{errors.name}</p>}
                </div>

                {/* Mobile */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold tracking-wider text-[var(--text-secondary)] uppercase block">
                    INDIAN MOBILE *
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className={`input-field text-sm ${errors.mobile ? 'border-red-500' : ''}`}
                  />
                  {errors.mobile && <p className="text-red-400 text-[10px] font-semibold">{errors.mobile}</p>}
                </div>

              </div>

              {/* Row 2: Corporate / Personal Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold tracking-wider text-[var(--text-secondary)] uppercase block">
                  EMAIL ADDRESS *
                </label>
                <input
                  type="email"
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`input-field text-sm ${errors.email ? 'border-red-500' : ''}`}
                />
                {errors.email && <p className="text-red-400 text-[10px] font-semibold">{errors.email}</p>}
              </div>

              {/* Row 3: Target Position Pills & Select */}
              <div className="space-y-2 pt-1">
                <label className="text-[10px] font-mono font-bold tracking-wider text-[var(--text-secondary)] uppercase block">
                  TARGET POSITION
                </label>

                {/* Quick Select Pills */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {TARGET_POSITIONS.map((pos) => (
                    <button
                      type="button"
                      key={pos}
                      onClick={() => setPosition(pos)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        position === pos
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30'
                          : 'bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                  placeholder="Or enter customized position title"
                />
              </div>

              {/* Row 4: Resume Drag & Drop Zone */}
              <div className="space-y-2 pt-1">
                <label className="text-[10px] font-mono font-bold tracking-wider text-[var(--text-secondary)] uppercase block">
                  RESUME FILE *
                </label>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    dragOver
                      ? 'border-[var(--border-focus)] bg-[var(--surface-hover)] scale-[1.01]'
                      : resume
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : errors.resume
                      ? 'border-red-500/50 bg-red-500/5'
                      : 'border-[var(--border)] bg-[var(--surface-hover)] hover:border-[var(--border-focus)]'
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
                    <div className="flex items-center justify-between bg-[var(--surface-card)] p-3 rounded-xl border border-emerald-500/30">
                      <div className="flex items-center gap-3 text-left">
                        <span className="text-2xl">📄</span>
                        <div>
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate max-w-xs">{resume.name}</p>
                          <p className="text-[10px] font-mono text-emerald-500 font-semibold">
                            {(resume.size / (1024 * 1024)).toFixed(2)} MB • Ready for Analysis
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setResume(null);
                        }}
                        className="p-1.5 rounded-lg bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-red-400 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-10 h-10 mx-auto rounded-2xl bg-[var(--primary-light)] flex items-center justify-center text-[var(--primary)]">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          Drag &amp; drop your resume, or browse
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                          PDF, DOC, DOCX up to 10MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {errors.resume && <p className="text-red-400 text-[10px] font-semibold">{errors.resume}</p>}
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-4 text-sm font-extrabold tracking-wide shadow-xl flex items-center justify-center gap-2 rounded-xl mt-2"
              >
                <span>Start AI Interview ➔</span>
              </button>

            </form>

          </div>

        </div>

      </div>

    </div>
  );
}
