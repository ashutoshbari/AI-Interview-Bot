'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { registerCandidate, getCandidateStatus } from '@/lib/api';

const POSITIONS = [
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
  'QA Engineer',
  'Other',
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
    if (!resume) newErrors.resume = 'Please upload your resume (PDF or DOC/DOCX)';
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
      'Uploading your resume...',
      'Extracting skills and experience...',
      'Analyzing your projects...',
      'Crafting personalized questions...',
      'Finalizing your interview setup...',
    ];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setLoadingMessage(messages[msgIdx]);
    }, 4000);

    // Progress bar animation
    const progInterval = setInterval(() => {
      setLoadingProgress(prev => Math.min(prev + 1.5, 95));
    }, 300);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('mobile', mobile.trim());
      formData.append('email', email.trim());
      formData.append('position', position);
      formData.append('resume', resume!);
      const candidate = await registerCandidate(formData);

      // Redirect immediately after registration success
      clearInterval(msgInterval);
      clearInterval(progInterval);
      setLoadingProgress(100);
      setLoadingMessage('Success! Redirecting to interview...');
      await new Promise(res => setTimeout(res, 800));
      router.push(`/interview?candidateId=${candidate.id}&name=${encodeURIComponent(candidate.name)}&total=12`);

    } catch (err: any) {
      clearInterval(msgInterval);
      clearInterval(progInterval);
      setIsSubmitting(false);
      setStep('form');

      // Structured error handling for FastAPI
      let detail = 'Something went wrong. Please try again.';
      if (err?.response?.data?.detail) {
        const rawDetail = err.response.data.detail;
        if (typeof rawDetail === 'string') {
          detail = rawDetail;
        } else if (Array.isArray(rawDetail)) {
          // Handle FastAPI 422 validation errors
          detail = rawDetail.map((d: any) => `${d.loc.join('.')}: ${d.msg}`).join(' | ');
        }
      }

      console.error('Registration Error Details:', err?.response?.data || err);
      setErrors({ form: detail });
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md w-full animate-fade-in">
          {/* Animated Logo */}
          <div className="relative w-28 h-28 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-primary-500/20 animate-ping" />
            <div className="absolute inset-3 rounded-full bg-primary-500/30 animate-ping" style={{ animationDelay: '0.2s' }} />
            <div className="relative flex items-center justify-center w-full h-full rounded-full bg-primary-500/40 border border-primary-400/50">
              <svg className="w-12 h-12 text-primary-300 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">{loadingMessage}</h2>
          <p className="text-white/50 text-sm mb-8">This usually takes 15–45 seconds</p>

          {/* Progress Bar */}
          <div className="w-full bg-white/10 rounded-full h-2 mb-4">
            <div
              className="bg-gradient-to-r from-primary-500 to-purple-500 h-2 rounded-full progress-bar"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-6">
            <span className="w-2 h-2 rounded-full bg-primary-400 dot-1" />
            <span className="w-2 h-2 rounded-full bg-primary-400 dot-2" />
            <span className="w-2 h-2 rounded-full bg-primary-400 dot-3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg animate-slide-up">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500/20 border border-primary-500/30 mb-4">
            <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AI Interview Bot</h1>
          <p className="text-white/50">Upload your resume and start your personalized interview</p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="card space-y-5">
          {errors.form && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
              {errors.form}
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className={`input-field ${errors.name ? 'ring-2 ring-red-500 border-red-500' : ''}`}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Mobile Number */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Mobile Number *</label>
            <input
              type="tel"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              placeholder="e.g. 9876543210"
              className={`input-field ${errors.mobile ? 'ring-2 ring-red-500 border-red-500' : ''}`}
            />
            {errors.mobile && <p className="text-red-400 text-xs mt-1">{errors.mobile}</p>}
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. rahul@example.com"
              className={`input-field ${errors.email ? 'ring-2 ring-red-500 border-red-500' : ''}`}
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Position */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Position Applying For</label>
            <select
              value={position}
              onChange={e => setPosition(e.target.value)}
              className="input-field"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}
            >
              {POSITIONS.map(p => (
                <option key={p} value={p} style={{ background: '#1e1b4b', color: 'white' }}>{p}</option>
              ))}
            </select>
          </div>

          {/* Resume Upload */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Resume *</label>
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 ${dragOver
                ? 'border-primary-400 bg-primary-500/10'
                : resume
                  ? 'border-green-500/50 bg-green-500/5'
                  : errors.resume
                    ? 'border-red-500/50 bg-red-500/5'
                    : 'border-white/20 hover:border-primary-400/60 hover:bg-white/5'
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
                <div className="flex items-center justify-center gap-3">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-left">
                    <p className="text-white text-sm font-medium">{resume.name}</p>
                    <p className="text-white/40 text-xs">{(resume.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ) : (
                <div>
                  <svg className="w-10 h-10 mx-auto text-white/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-white/60 text-sm">Drag & drop or <span className="text-primary-400 font-medium">browse</span></p>
                  <p className="text-white/30 text-xs mt-1">PDF, DOC, DOCX — Max 10 MB</p>
                </div>
              )}
            </div>
            {errors.resume && <p className="text-red-400 text-xs mt-1">{errors.resume}</p>}
          </div>

          {/* Submit */}
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full mt-2 text-base">
            {isSubmitting ? 'Starting...' : '🚀 Start Interview'}
          </button>

          <p className="text-center text-white/30 text-xs">
            Your interview will consist of ~12 personalized questions
          </p>
        </form>
      </div>
    </div>
  );
}
