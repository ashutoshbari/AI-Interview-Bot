'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { registerCandidate, sendOTP } from '@/lib/api';

const POPULAR_POSITIONS = [
  'Software Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Data Scientist',
  'Machine Learning Engineer',
  'DevOps Engineer',
  'Cloud Architect',
  'Mobile Developer',
  'Product Manager',
  'QA Automation Engineer',
];

type Step = 'form' | 'loading';

export default function RegistrationPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('Software Engineer');
  const [resume, setResume] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Uploading your resume...');
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
      'Analyzing your resume architecture...',
      'Extracting skills, projects & experience...',
      'Synthesizing personalized question matrix...',
      'Generating candidate security PIN...',
      'Finalizing your AI interview room...',
    ];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setLoadingMessage(messages[msgIdx]);
    }, 2800);

    const progInterval = setInterval(() => {
      setLoadingProgress(prev => Math.min(prev + 2.5, 92));
    }, 200);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('mobile', mobile.trim());
      formData.append('email', email.trim());
      formData.append('position', position);
      formData.append('resume', resume!);
      
      const candidate = await registerCandidate(formData);

      clearInterval(msgInterval);
      clearInterval(progInterval);
      setLoadingProgress(100);
      setLoadingMessage('Success! Opening verification room...');

      // Dispatch OTP asynchronously
      try {
        await sendOTP(candidate.id);
      } catch (otpErr) {
        console.warn('Initial OTP send warning (can be requested on verify page):', otpErr);
      }

      await new Promise(res => setTimeout(res, 500));
      router.push(`/verify?candidateId=${candidate.id}&name=${encodeURIComponent(candidate.name)}`);

    } catch (err: any) {
      clearInterval(msgInterval);
      clearInterval(progInterval);
      setIsSubmitting(false);
      setStep('form');

      let detail = 'Something went wrong. Please check your network and try again.';
      if (err?.response?.data?.detail) {
        const rawDetail = err.response.data.detail;
        if (typeof rawDetail === 'string') {
          detail = rawDetail;
        } else if (Array.isArray(rawDetail)) {
          detail = rawDetail.map((d: any) => `${d.loc.join('.')}: ${d.msg}`).join(' | ');
        }
      }

      console.error('Registration Error Details:', err?.response?.data || err);
      setErrors({ form: detail });
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-primary-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center max-w-md w-full relative z-10 animate-fade-in p-8 glass-card">
          {/* Animated AI Brain Icon */}
          <div className="relative w-28 h-28 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-primary-500/20 animate-ping opacity-50" />
            <div className="absolute inset-2 rounded-full bg-purple-500/30 animate-pulse" />
            <div className="relative flex items-center justify-center w-full h-full rounded-full bg-gradient-to-br from-primary-500/40 to-purple-600/40 border-2 border-primary-400/60 shadow-2xl shadow-primary-500/30">
              <svg className="w-14 h-14 text-primary-200 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">{loadingMessage}</h2>
          <p className="text-white/50 text-xs mb-6">Powered by Google Gemini Adaptive Intelligence</p>

          {/* Progress Bar */}
          <div className="w-full bg-white/10 rounded-full h-2.5 mb-4 overflow-hidden p-0.5 border border-white/10">
            <div
              className="bg-gradient-to-r from-primary-500 via-purple-500 to-cyan-400 h-full rounded-full progress-bar shadow-lg shadow-primary-500/50"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-white/40 font-mono">
            <span>Parsing Profile</span>
            <span>{Math.round(loadingProgress)}%</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorative Blur Orbs */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-primary-500/10 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 space-y-12 animate-fade-in">
        
        {/* Top Hero Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glow-badge text-xs font-semibold text-primary-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AI Neural Interviewer 2.0 • Active</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            Elevate Your Career with <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-cyan-400">
              AI-Powered Technical Interviews
            </span>
          </h1>

          <p className="text-white/60 text-base sm:text-lg max-w-2xl mx-auto">
            Upload your resume to experience a dynamic, voice-enabled interview tailored specifically to your projects, skills, and target engineering role.
          </p>

          {/* Stepper Progression */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 max-w-3xl mx-auto">
            {[
              { step: '01', title: 'Upload Resume', desc: 'PDF / DOCX' },
              { step: '02', title: 'Verify OTP', desc: 'Secure Access' },
              { step: '03', title: 'Voice Interview', desc: 'Adaptive AI' },
              { step: '04', title: 'Get Scorecard', desc: 'PDF Report' },
            ].map((s, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-3 text-left hover:border-primary-400/40 transition-colors">
                <span className="text-xs font-mono font-bold text-primary-400">{s.step}</span>
                <p className="text-xs font-bold text-white mt-0.5">{s.title}</p>
                <p className="text-[11px] text-white/40">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Main Registration Form Card */}
        <div className="glass-card max-w-2xl mx-auto p-6 sm:p-10 border border-white/15 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {errors.form && (
              <div className="bg-red-500/15 border border-red-500/30 rounded-2xl px-4 py-3 text-red-300 text-sm text-center flex items-center justify-center gap-2">
                <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{errors.form}</span>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-white/80 mb-2">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Ashutosh Bari"
                className={`input-field ${errors.name ? 'border-red-500 focus:ring-red-500/30' : ''}`}
              />
              {errors.name && <p className="text-red-400 text-xs mt-1.5">{errors.name}</p>}
            </div>

            {/* Email & Mobile Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-2">Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. ashu@example.com"
                  className={`input-field ${errors.email ? 'border-red-500 focus:ring-red-500/30' : ''}`}
                />
                {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/80 mb-2">Mobile Number *</label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className={`input-field ${errors.mobile ? 'border-red-500 focus:ring-red-500/30' : ''}`}
                />
                {errors.mobile && <p className="text-red-400 text-xs mt-1.5">{errors.mobile}</p>}
              </div>
            </div>

            {/* Position Selector */}
            <div>
              <label className="block text-sm font-semibold text-white/80 mb-2">Target Position *</label>
              <select
                value={position}
                onChange={e => setPosition(e.target.value)}
                className="input-field cursor-pointer"
                style={{ background: '#0e0e28', color: 'white' }}
              >
                {POPULAR_POSITIONS.map(p => (
                  <option key={p} value={p} style={{ background: '#0f0f26', color: 'white' }}>{p}</option>
                ))}
              </select>

              {/* Quick Select Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Data Scientist'].map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setPosition(chip)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                      position === chip
                        ? 'bg-primary-500/30 border-primary-400 text-white font-semibold'
                        : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white/80'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Resume Upload Dropzone */}
            <div>
              <label className="block text-sm font-semibold text-white/80 mb-2">Upload Resume (PDF, DOC, DOCX) *</label>
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-7 text-center transition-all duration-200 ${
                  dragOver
                    ? 'border-primary-400 bg-primary-500/15 scale-[1.01]'
                    : resume
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : errors.resume
                        ? 'border-red-500/50 bg-red-500/5'
                        : 'border-white/20 hover:border-primary-400/70 hover:bg-white/5'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={e => handleFileChange(e.target.files?.[0] || null)}
                />

                {resume ? (
                  <div className="flex items-center justify-between gap-4 px-2">
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold truncate max-w-xs">{resume.name}</p>
                        <p className="text-emerald-300/80 text-xs font-mono">{(resume.size / 1024).toFixed(1)} KB • Ready for Analysis</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setResume(null);
                      }}
                      className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-300 text-white/50 transition-colors"
                      title="Remove file"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-400">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <p className="text-white font-medium text-sm">
                      Drag and drop your resume here, or <span className="text-primary-400 underline underline-offset-2">browse file</span>
                    </p>
                    <p className="text-white/40 text-xs">Supported: PDF, DOC, DOCX (Max 10 MB)</p>
                  </div>
                )}
              </div>
              {errors.resume && <p className="text-red-400 text-xs mt-1.5">{errors.resume}</p>}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary-500/25"
            >
              <span>🚀 Begin AI Interview Setup</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>

            <p className="text-center text-white/40 text-xs">
              🔒 Your data is processed securely and privately for interview evaluation only.
            </p>
          </form>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="glass-card glass-card-hover p-6 border border-white/10">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-2xl mb-4">
              🎙️
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5">Interactive AI Voice</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Experience human-like speech synthesis and instant audio transcription with noise filtering.
            </p>
          </div>

          <div className="glass-card glass-card-hover p-6 border border-white/10">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-2xl mb-4">
              🧠
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5">Adaptive Questioning</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Questions adapt in real-time based on the depth and accuracy of your previous responses.
            </p>
          </div>

          <div className="glass-card glass-card-hover p-6 border border-white/10">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-2xl mb-4">
              📊
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5">Instant Scorecard</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Get an immediate breakdown of technical depth, clarity, communication, and downloadable PDF report.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
