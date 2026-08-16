'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyOTP, sendOTP } from '@/lib/api';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const candidateId = Number(searchParams.get('candidateId'));
  const candidateName = decodeURIComponent(searchParams.get('name') || 'Candidate');

  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!candidateId) {
      router.push('/');
    } else {
      // Focus first input on load
      inputRefs.current[0]?.focus();
    }
  }, [candidateId, router]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned && value !== '') return;

    const newOtp = [...otp];

    // Handle multi-digit paste or fast typing
    if (cleaned.length > 1) {
      const digits = cleaned.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || '';
      }
      setOtp(newOtp);
      const nextIdx = Math.min(digits.length, 5);
      inputRefs.current[nextIdx]?.focus();

      if (digits.length === 6) {
        triggerVerification(digits.join(''));
      }
      return;
    }

    newOtp[index] = cleaned;
    setOtp(newOtp);
    setError('');

    // Advance to next input
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // If 6th digit entered, auto submit
    if (cleaned && index === 5) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        triggerVerification(fullOtp);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newOtp = [...otp];
    pasted.split('').forEach((digit, i) => {
      newOtp[i] = digit;
    });
    setOtp(newOtp);

    const nextEmpty = newOtp.findIndex(v => v === '');
    const targetIdx = nextEmpty === -1 ? 5 : nextEmpty;
    inputRefs.current[targetIdx]?.focus();

    if (pasted.length === 6) {
      triggerVerification(pasted);
    }
  };

  const triggerVerification = async (code: string) => {
    if (loading || code.length !== 6) return;
    setLoading(true);
    setError('');

    try {
      await verifyOTP(candidateId, code);
      setIsSuccess(true);
      setSuccessMsg('🎉 Identity verified! Entering interview room...');
      setTimeout(() => {
        router.push(`/interview?candidateId=${candidateId}&name=${encodeURIComponent(candidateName)}&total=12`);
      }, 600);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Invalid or expired verification code.';
      setError(msg);
      // Auto-clear for fresh input
      setOtp(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerVerification(otp.join(''));
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await sendOTP(candidateId);
      setCooldown(60);
      setSuccessMsg('📨 A fresh 6-digit code has been sent to your email.');
      setError('');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to resend code. Please try again.');
    }
  };

  const handleQuickDemoBypass = () => {
    const demoCode = ['1', '2', '3', '4', '5', '6'];
    setOtp(demoCode);
    triggerVerification('123456');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background Decorative Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 animate-fade-in">
        
        {/* Header Badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 border border-primary-500/30 mb-5 shadow-lg shadow-primary-500/10 relative">
            <div className="absolute inset-0 rounded-3xl bg-primary-400/20 animate-ping opacity-30" />
            <svg className="w-10 h-10 text-primary-300 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Verify Your Identity
          </h1>
          <p className="text-white/60 text-sm max-w-sm mx-auto">
            We've sent a 6-digit security code to your registered email for <strong className="text-primary-300">{candidateName}</strong>.
          </p>
        </div>

        {/* Verification Card */}
        <div className="glass-card p-8 border border-white/15 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Error Message Toast */}
            {error && (
              <div className="bg-red-500/15 border border-red-500/30 rounded-2xl px-4 py-3.5 text-red-300 text-sm text-center flex items-center justify-center gap-2.5 animate-shake">
                <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl px-4 py-3 text-emerald-300 text-sm text-center flex items-center justify-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{successMsg}</span>
              </div>
            )}

            {/* 6 Digit Input Boxes */}
            <div className="flex justify-between gap-2 sm:gap-3 my-4">
              {otp.map((digit, i) => {
                const isFilled = Boolean(digit);
                return (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    disabled={loading || isSuccess}
                    className={`w-12 h-16 sm:w-14 sm:h-18 text-center text-3xl font-mono font-bold rounded-2xl transition-all duration-200 ${
                      isFilled
                        ? 'bg-primary-500/20 border-2 border-primary-400 text-white shadow-lg shadow-primary-500/20 scale-105'
                        : 'bg-white/5 border-2 border-white/10 text-white/90 hover:border-white/25 focus:border-primary-400 focus:bg-primary-500/10 focus:ring-4 focus:ring-primary-500/20'
                    }`}
                  />
                );
              })}
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading || otp.join('').length !== 6 || isSuccess}
              className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                  </svg>
                  <span>Verifying Code...</span>
                </>
              ) : isSuccess ? (
                <>
                  <svg className="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Verified! Unlocking Room...</span>
                </>
              ) : (
                <>
                  <span>Verify & Enter Interview</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>

            {/* Demo 1-Click Auto Fill */}
            <div className="pt-2 border-t border-white/10 text-center">
              <button
                type="button"
                onClick={handleQuickDemoBypass}
                className="text-xs text-primary-300/80 hover:text-primary-200 transition-colors py-1 px-3 rounded-lg hover:bg-white/5 inline-flex items-center gap-1.5"
              >
                <span>⚡ Test Mode: Instant Auto-fill (123456)</span>
              </button>
            </div>
          </form>

          {/* Resend Code Section */}
          <div className="mt-6 text-center">
            <p className="text-white/50 text-sm">
              Didn't receive the email?{' '}
              <button 
                type="button" 
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
                className={`font-semibold transition-colors ${
                  cooldown > 0 
                    ? 'text-white/30 cursor-not-allowed' 
                    : 'text-primary-400 hover:text-primary-300 underline underline-offset-4'
                }`}
              >
                {cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Code Now'}
              </button>
            </p>
          </div>
        </div>

        {/* Security Badge */}
        <div className="mt-8 flex items-center justify-center gap-2 text-white/40 text-xs">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>End-to-end encrypted session • AI Proctoring Enabled</span>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
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
      <VerifyContent />
    </Suspense>
  );
}
