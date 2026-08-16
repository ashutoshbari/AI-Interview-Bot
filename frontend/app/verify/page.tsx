'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { verifyOTP, sendOTP } from '@/lib/api';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const candidateId = Number(searchParams.get('candidateId'));
  const candidateName = decodeURIComponent(searchParams.get('name') || 'Candidate');
  const candidateEmail = decodeURIComponent(searchParams.get('email') || '');

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
      inputRefs.current[0]?.focus();
    }
  }, [candidateId, router]);

  // Resend cooldown countdown
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned && value !== '') return;

    const newOtp = [...otp];

    // Multi-digit paste or quick typing
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

    const nextEmpty = newOtp.findIndex((v) => v === '');
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
      setSuccessMsg('🎉 Identity verified successfully! Entering interview room...');
      setTimeout(() => {
        router.push(
          `/interview?candidateId=${candidateId}&name=${encodeURIComponent(
            candidateName
          )}&total=12`
        );
      }, 700);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Invalid or expired verification code.';
      setError(msg);
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
      setSuccessMsg('📨 A fresh 6-digit verification code has been dispatched.');
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

  // Masked email representation
  const maskedEmail = candidateEmail
    ? candidateEmail.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}***${c}`)
    : 'your registered email';

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-8 relative z-10 animate-fade-in">
      
      {/* 4-Step Indicator Bar */}
      <div className="glass-panel rounded-full p-2 max-w-4xl mx-auto flex items-center justify-between gap-2 border border-[var(--border)]">
        <div className="flex-1 px-4 py-2 rounded-full text-center text-xs font-bold text-[var(--text-muted)] flex items-center justify-center gap-2">
          <span className="font-mono">01</span>
          <span>Upload Resume</span>
        </div>
        <div className="flex-1 px-4 py-2 rounded-full text-center text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2">
          <span className="font-mono">02</span>
          <span>Verify OTP</span>
        </div>
        <div className="flex-1 px-4 py-2 rounded-full text-center text-xs font-bold text-[var(--text-muted)] flex items-center justify-center gap-2">
          <span className="font-mono">03</span>
          <span>AI Interview</span>
        </div>
        <div className="flex-1 px-4 py-2 rounded-full text-center text-xs font-bold text-[var(--text-muted)] flex items-center justify-center gap-2">
          <span className="font-mono">04</span>
          <span>Scorecard</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        
        {/* Header Badge */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center justify-center bg-white p-2 rounded-2xl shadow-md border border-slate-200 dark:border-white/10 mb-2">
            <Image
              src="/ashvance_logo.png"
              alt="ASHVANCE TECH Logo"
              width={140}
              height={42}
              className="object-contain h-8 w-auto"
              priority
            />
          </div>

          <h1 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
            Verify Your Identity
          </h1>

          <p className="text-[var(--text-secondary)] text-sm max-w-sm mx-auto leading-relaxed">
            One-Time Password has been dispatched for <strong className="text-[var(--text-primary)]">{candidateName}</strong> to:
            <br />
            <span className="font-mono text-xs font-bold text-[var(--secondary)]">{maskedEmail}</span>
          </p>
        </div>

        {/* Verification Card */}
        <div className="glass-card p-8 border border-[var(--border)] shadow-2xl space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Error Message Toast */}
            {error && (
              <div className="bg-red-500/15 border border-red-500/30 rounded-2xl px-4 py-3.5 text-red-500 text-sm text-center flex items-center justify-center gap-2.5 font-medium animate-shake">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl px-4 py-3 text-emerald-500 text-sm text-center flex items-center justify-center gap-2 font-medium">
                <span>✓</span>
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
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    disabled={loading || isSuccess}
                    className={`w-12 h-16 sm:w-14 sm:h-18 text-center text-3xl font-mono font-bold rounded-2xl transition-all duration-200 ${
                      isFilled
                        ? 'bg-[var(--primary-light)] border-2 border-[var(--primary)] text-[var(--text-primary)] shadow-md scale-105'
                        : 'bg-[var(--surface-hover)] border-2 border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--border-focus)] focus:border-[var(--primary)] focus:bg-[var(--primary-light)]'
                    }`}
                  />
                );
              })}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || otp.join('').length !== 6 || isSuccess}
              className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2 shadow-lg"
            >
              {loading ? (
                <span>Verifying Security PIN...</span>
              ) : isSuccess ? (
                <span>Identity Verified! Entering Studio...</span>
              ) : (
                <span>Verify &amp; Enter Interview ➔</span>
              )}
            </button>

            {/* Demo 1-Click Auto Fill */}
            <div className="pt-2 border-t border-[var(--border)] text-center">
              <button
                type="button"
                onClick={handleQuickDemoBypass}
                className="text-xs text-[var(--secondary)] hover:underline transition-colors py-1 px-3 rounded-lg hover:bg-[var(--surface-hover)] inline-flex items-center gap-1.5 font-medium"
              >
                <span>⚡ Test Mode: Instant Auto-fill (123456)</span>
              </button>
            </div>
          </form>

          {/* Resend Code Section */}
          <div className="mt-4 text-center">
            <p className="text-[var(--text-secondary)] text-xs">
              Didn't receive the verification code?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
                className={`font-bold transition-colors ${
                  cooldown > 0
                    ? 'text-[var(--text-muted)] cursor-not-allowed'
                    : 'text-[var(--primary)] hover:underline'
                }`}
              >
                {cooldown > 0 ? `Resend Code in ${cooldown}s` : 'Resend Code Now'}
              </button>
            </p>
          </div>
        </div>

        {/* Proctoring & Security Badge */}
        <div className="mt-8 flex items-center justify-center gap-2 text-[var(--text-muted)] text-xs">
          <span>🔒</span>
          <span>Official ASHVANCE TECH Enterprise Session • End-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--secondary)] border-t-transparent animate-spin" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
