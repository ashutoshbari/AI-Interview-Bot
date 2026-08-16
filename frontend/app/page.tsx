'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { registerCandidate, sendOTP } from '@/lib/api';

const FEATURED_ROLES = [
  { label: 'Full-Stack Engineer', icon: '💻', tag: 'High Demand' },
  { label: 'AI / ML Engineer', icon: '🤖', tag: 'Trending' },
  { label: 'Frontend Developer', icon: '🎨', tag: 'Popular' },
  { label: 'Backend Architect', icon: '⚙️', tag: 'Core Tech' },
  { label: 'Data Scientist', icon: '📊', tag: 'Analytics' },
  { label: 'Product Manager', icon: '🚀', tag: 'Leadership' },
];

export default function RegistrationPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'form' | 'loading'>('form');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('Full-Stack Engineer');
  const [resume, setResume] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Uploading & analyzing resume...');
  const [loadingProgress, setLoadingProgress] = useState(0);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) newErrors.name = 'Full name must be at least 2 characters';
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
      setErrors(prev => ({ ...prev, resume: 'Only PDF, DOC, and DOCX files are supported' }));
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
      'Extracting skills & experience from resume...',
      'Synthesizing role-specific interview matrix...',
      'Generating candidate security PIN & OTP...',
      'Preparing your interactive AI session room...',
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
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        <div className="glass-card max-w-lg w-full p-8 sm:p-10 text-center space-y-6 animate-fade-in relative z-10 border border-primary-500/30">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-primary-600 to-indigo-500 p-0.5 shadow-2xl shadow-primary-500/40">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
              <svg className="w-10 h-10 text-primary-400 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="60" strokeDashoffset="20" />
              </svg>
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight">Setting Up Your AI Interview</h2>
            <p className="text-primary-300 font-mono text-xs animate-pulse">{loadingMessage}</p>
          </div>

          <div className="space-y-2">
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-primary-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-white/40">
              <span>INITIALIZING</span>
              <span>{Math.round(loadingProgress)}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-10 relative overflow-hidden">
      
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary-600/15 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header Badge & Title */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glow-badge text-xs font-bold text-primary-200">
          <span className="text-sm">⚡</span>
          <span>Google Gemini 2.5 Flash Powered</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        </div>

        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
          Next-Gen <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-indigo-300 to-purple-400">AI Technical Interview</span> Platform
        </h1>
        <p className="text-white/60 text-sm sm:text-base leading-relaxed">
          Upload your resume to receive a personalized, dynamic technical evaluation with real-time audio voice mode & anti-cheat proctoring.
        </p>
      </div>

      {/* Workflow Stepper Bar */}
      <div className="glass-panel rounded-2xl p-4 max-w-3xl mx-auto grid grid-cols-4 gap-2 text-center text-xs">
        <div className="flex items-center justify-center gap-2 font-bold text-primary-400 border-b-2 border-primary-400 pb-1">
          <span className="w-5 h-5 rounded-full bg-primary-500/20 flex items-center justify-center text-[10px]">1</span>
          <span className="hidden sm:inline">Profile & Resume</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-white/40 pb-1">
          <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px]">2</span>
          <span className="hidden sm:inline">OTP Verification</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-white/40 pb-1">
          <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px]">3</span>
          <span className="hidden sm:inline">AI Session</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-white/40 pb-1">
          <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px]">4</span>
          <span className="hidden sm:inline">Scorecard</span>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="glass-card max-w-3xl mx-auto p-6 sm:p-10 relative border border-white/15">
        
        {errors.global && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <p>{errors.global}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Target Role Selector Grid */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-white/80 uppercase tracking-wider block">
              1. Select Target Position
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {FEATURED_ROLES.map((r) => (
                <button
                  type="button"
                  key={r.label}
                  onClick={() => setPosition(r.label)}
                  className={`p-3 rounded-xl text-left border transition-all flex items-center gap-2.5 ${
                    position === r.label
                      ? 'bg-primary-600/25 border-primary-400 text-white shadow-lg shadow-primary-500/20'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <span className="text-lg">{r.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{r.label}</p>
                    <span className="text-[9px] font-mono text-primary-300/70">{r.tag}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Contact & Personal Details */}
          <div className="space-y-4 pt-2">
            <label className="text-xs font-bold text-white/80 uppercase tracking-wider block">
              2. Candidate Details
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 flex justify-between">
                  <span>Full Name</span>
                  {name && name.length >= 2 && <span className="text-emerald-400 text-[10px]">✓ Valid</span>}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ashutosh Bari"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`input-field ${errors.name ? 'border-red-500' : ''}`}
                />
                {errors.name && <p className="text-red-400 text-[10px]">{errors.name}</p>}
              </div>

              {/* Mobile Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70 flex justify-between">
                  <span>Mobile Number</span>
                  {mobile.replace(/\D/g, '').length >= 10 && <span className="text-emerald-400 text-[10px]">✓ Valid</span>}
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 09921589619"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className={`input-field ${errors.mobile ? 'border-red-500' : ''}`}
                />
                {errors.mobile && <p className="text-red-400 text-[10px]">{errors.mobile}</p>}
              </div>

              {/* Email Address */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-white/70 flex justify-between">
                  <span>Email Address (For OTP Verification & Scorecard)</span>
                  {/^\S+@\S+\.\S+$/.test(email) && <span className="text-emerald-400 text-[10px]">✓ Valid</span>}
                </label>
                <input
                  type="email"
                  placeholder="e.g. ashutoshbari424204@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`input-field ${errors.email ? 'border-red-500' : ''}`}
                />
                {errors.email && <p className="text-red-400 text-[10px]">{errors.email}</p>}
              </div>

            </div>
          </div>

          {/* Resume Upload Dropzone */}
          <div className="space-y-2.5 pt-2">
            <label className="text-xs font-bold text-white/80 uppercase tracking-wider block">
              3. Upload Resume (PDF / DOCX)
            </label>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-primary-400 bg-primary-500/10 scale-[1.01]'
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
                <div className="flex items-center justify-between bg-slate-900/80 p-3.5 rounded-xl border border-emerald-500/30">
                  <div className="flex items-center gap-3 text-left">
                    <span className="text-2xl">📄</span>
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-xs">{resume.name}</p>
                      <p className="text-[10px] font-mono text-emerald-400">
                        {(resume.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI Parsing
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setResume(null); }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-primary-500/10 border border-primary-400/20 flex items-center justify-center text-primary-300">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Click to browse or drop your resume here</p>
                    <p className="text-[10px] text-white/40 font-mono mt-1">Supports PDF, DOC, DOCX up to 10MB</p>
                  </div>
                </div>
              )}
            </div>
            {errors.resume && <p className="text-red-400 text-[10px]">{errors.resume}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-4 text-base font-extrabold tracking-wide shadow-xl shadow-primary-500/30 flex items-center justify-center gap-2.5 rounded-2xl"
          >
            <span>🚀 Start AI Interview Session</span>
          </button>
        </form>
      </div>

      {/* Feature Value Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 max-w-3xl mx-auto pt-4">
        <div className="glass-panel p-4 rounded-2xl text-center space-y-1 border border-white/10">
          <span className="text-2xl">🤖</span>
          <h4 className="text-xs font-bold text-white">Gemini 2.5 Flash</h4>
          <p className="text-[10px] text-white/50">Dynamic question generation</p>
        </div>
        <div className="glass-panel p-4 rounded-2xl text-center space-y-1 border border-white/10">
          <span className="text-2xl">🎙️</span>
          <h4 className="text-xs font-bold text-white">Interactive Voice Mode</h4>
          <p className="text-[10px] text-white/50">Real-time speech & TTS</p>
        </div>
        <div className="glass-panel p-4 rounded-2xl text-center space-y-1 border border-white/10">
          <span className="text-2xl">🛡️</span>
          <h4 className="text-xs font-bold text-white">Anti-Cheat Proctoring</h4>
          <p className="text-[10px] text-white/50">Tab switch & paste check</p>
        </div>
        <div className="glass-panel p-4 rounded-2xl text-center space-y-1 border border-white/10">
          <span className="text-2xl">📊</span>
          <h4 className="text-xs font-bold text-white">PDF Scorecard</h4>
          <p className="text-[10px] text-white/50">Multidimensional analytics</p>
        </div>
      </div>

    </div>
  );
}
