'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import {
  getCandidateByToken,
  verifyOTPByToken,
  getQuestionsByToken,
  submitAnswerByToken,
  clarifyQuestionByToken,
  finishInterviewByToken,
  CandidateTokenInfo,
  Question,
} from '@/lib/api';
import LoadingState from '@/components/LoadingState';

const STAGE_META: Record<string, { label: string; icon: string; color: string }> = {
  greeting:            { label: 'Introduction',            icon: '👋', color: 'text-indigo-400' },
  background:          { label: 'Background & Journey',    icon: '📋', color: 'text-blue-400' },
  project_deep_dive:   { label: 'Project Deep Dive',       icon: '🏗️', color: 'text-purple-400' },
  technical:           { label: 'Technical Architecture',  icon: '⚙️', color: 'text-cyan-400' },
  problem_solving:     { label: 'Problem Solving',         icon: '🧠', color: 'text-amber-400' },
  behavioral:          { label: 'Behavioral & Leadership', icon: '🤝', color: 'text-emerald-400' },
  candidate_questions: { label: 'Candidate Questions',     icon: '💬', color: 'text-violet-400' },
  closing:             { label: 'Closing Assessment',      icon: '🎯', color: 'text-teal-400' },
};

const STAGE_ORDER = [
  'greeting',
  'background',
  'project_deep_dive',
  'technical',
  'problem_solving',
  'behavioral',
  'candidate_questions',
];

type AIState = 'speaking' | 'listening' | 'thinking' | 'processing' | 'idle';

const RESPONSE_SECONDS = 60;
const SILENCE_TIMEOUT_MS = 2400;
const MIN_SPEECH_LENGTH = 10;

export default function TokenInterviewPage() {
  const router = useRouter();
  const params = useParams();
  const token = (params?.token as string) || '';

  // ── Candidate & Token Status ────────────────────────────────────────────────
  const [candidateInfo, setCandidateInfo] = useState<CandidateTokenInfo | null>(null);
  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid' | 'expired' | 'completed' | 'otp_required'>('checking');
  const [errorMessage, setErrorMessage] = useState('');

  // ── Pre-flight Hardware Check ───────────────────────────────────────────────
  const [preflightDone, setPreflightDone] = useState(false);
  const [micStatus, setMicStatus] = useState<'pending' | 'checking' | 'granted' | 'denied'>('pending');
  const [speakerStatus, setSpeakerStatus] = useState<'ready' | 'checking'>('ready');
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');

  // ── OTP State (if token requires verification) ──────────────────────────────
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Core Interview State ────────────────────────────────────────────────────
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionNum, setQuestionNum] = useState(1);
  const [answer, setAnswer] = useState('');
  const [aiState, setAiState] = useState<AIState>('idle');
  const [loading, setLoading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [currentStage, setCurrentStage] = useState('greeting');

  // ── Timer & Speech State ────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(RESPONSE_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // ── Clarification & Finish Modal ────────────────────────────────────────────
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [clarifyQuery, setClarifyQuery] = useState('');
  const [isClarifying, setIsClarifying] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);
  const answerRef = useRef('');
  const currentQuestionRef = useRef<Question | null>(null);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);
  useEffect(() => {
    currentQuestionRef.current = question;
  }, [question]);

  // Network offline/online listeners
  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus('online');
      setIsReconnecting(false);
    };
    const handleOffline = () => {
      setNetworkStatus('offline');
      setIsReconnecting(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── 1. Validate Token on Mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setTokenStatus('invalid');
      setErrorMessage('No interview token specified in the URL.');
      return;
    }

    const validateToken = async () => {
      setTokenStatus('checking');
      try {
        const info = await getCandidateByToken(token);
        setCandidateInfo(info);

        if (info.is_completed || info.status === 'COMPLETED') {
          setTokenStatus('completed');
        } else if (!info.is_verified) {
          setTokenStatus('otp_required');
        } else {
          setTokenStatus('valid');
        }
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 410) {
          setTokenStatus('expired');
          setErrorMessage(err?.response?.data?.detail || 'This interview link has expired.');
        } else {
          setTokenStatus('invalid');
          setErrorMessage(err?.response?.data?.detail || 'This interview link is no longer valid.');
        }
      }
    };

    validateToken();
  }, [token]);

  // ── Pre-flight Hardware Verification ────────────────────────────────────────
  const runPreflightCheck = async () => {
    setMicStatus('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicStatus('granted');
      setPreflightDone(true);
      startInterviewSession();
    } catch {
      setMicStatus('denied');
    }
  };

  // ── TTS Voice Output ────────────────────────────────────────────────────────
  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (typeof window === 'undefined' || !window.speechSynthesis || isMuted) {
        setAiState('idle');
        if (onEnd) onEnd();
        return;
      }

      window.speechSynthesis.cancel();
      setAiState('speaking');

      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();

        const naturalVoice =
          voices.find((v) => v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Google US English')) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          voices[0];

        if (naturalVoice) utterance.voice = naturalVoice;
        utterance.pitch = 1.05;
        utterance.rate = 0.95;

        utterance.onend = () => {
          setAiState('idle');
          if (onEnd) onEnd();
        };
        utterance.onerror = () => {
          setAiState('idle');
          if (onEnd) onEnd();
        };

        window.speechSynthesis.speak(utterance);
      }, 100);
    },
    [isMuted]
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setAiState('idle');
    }
  }, []);

  // ── Microphone & Speech Recognition ─────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    if (isProcessingRef.current) return;

    setLiveTranscript('');
    setAnswer('');
    answerRef.current = '';

    setTimeLeft(RESPONSE_SECONDS);
    setTimerActive(true);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsVoiceMode(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + ' ';
        } else {
          interimText += event.results[i][0].transcript;
        }
      }

      const full = (finalText + interimText).trim();
      setLiveTranscript(full);
      setAnswer(full);
      answerRef.current = full;

      if (full.length > MIN_SPEECH_LENGTH) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        // Auto-submit on 2.4s silence
        silenceTimerRef.current = setTimeout(() => {
          if (answerRef.current.trim().length > MIN_SPEECH_LENGTH && !isProcessingRef.current) {
            stopListening();
            handleAutoSubmit();
          }
        }, SILENCE_TIMEOUT_MS);
      }
    };

    recognition.onerror = () => {};
    recognition.onend = () => {
      if (isListening && !isProcessingRef.current) {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    setAiState('listening');

    try {
      recognition.start();
    } catch {}
  }, [isListening, stopListening]);

  // Barge-in: Candidate interruption stops AI speaking
  useEffect(() => {
    if (isListening && aiState === 'speaking') {
      stopSpeaking();
    }
  }, [isListening, aiState, stopSpeaking]);

  // ── Response Timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerActive) return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimerActive(false);
          if (!isProcessingRef.current) {
            handleAutoSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current!);
    };
  }, [timerActive]);

  // ── Start Interview Session ─────────────────────────────────────────────────
  const startInterviewSession = async () => {
    setLoading(true);
    try {
      const qs = await getQuestionsByToken(token);
      if (qs && qs.length > 0) {
        const q = qs[0];
        setQuestion(q);
        setQuestionNum(q.question_order);
        setCurrentStage(q.stage || 'greeting');

        if (isVoiceMode) {
          speak(q.question, () => {
            if (!isMuted) startListening();
          });
        }
      }
    } catch (e: any) {
      setErrorMessage(e?.response?.data?.detail || 'Connecting to AI Interviewer...');
    } finally {
      setLoading(false);
    }
  };

  // ── Submit Answer & Advance ─────────────────────────────────────────────────
  const processSubmission = useCallback(
    async (submittedAnswer: string) => {
      if (isProcessingRef.current || !currentQuestionRef.current) return;
      if (!submittedAnswer.trim()) {
        submittedAnswer = '[No verbal answer recorded — timer elapsed]';
      }

      isProcessingRef.current = true;
      stopListening();
      setTimerActive(false);
      setAiState('thinking');

      try {
        const result = await submitAnswerByToken(
          token,
          currentQuestionRef.current.question_order,
          submittedAnswer
        );

        setAiState('processing');

        if (result.interview_complete || !result.next_question) {
          setCompletedStages(STAGE_ORDER);
          speak(
            'Thank you for completing your interview with ASHVANCE TECH. Generating your executive scorecard and assessment report now.',
            () => {
              setGeneratingReport(true);
              setTimeout(() => {
                router.push(`/report/${token}`);
              }, 1200);
            }
          );
        } else {
          const nextQ = result.next_question;
          setCompletedStages((prev) =>
            prev.includes(currentStage) ? prev : [...prev, currentStage]
          );

          setQuestion(nextQ);
          setQuestionNum(nextQ.question_order);
          setCurrentStage(nextQ.stage || 'technical');
          setAnswer('');
          setLiveTranscript('');

          speak(nextQ.question, () => {
            if (isVoiceMode && !isMuted) {
              startListening();
            }
          });
        }
      } catch {
        setAiState('idle');
      } finally {
        isProcessingRef.current = false;
      }
    },
    [token, currentStage, isVoiceMode, isMuted, speak, startListening, stopListening, router]
  );

  const handleAutoSubmit = useCallback(() => {
    processSubmission(answerRef.current);
  }, [processSubmission]);

  // ── OTP Handler ─────────────────────────────────────────────────────────────
  const handleOtpChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    const newOtp = [...otpDigits];

    if (clean.length > 1) {
      const digits = clean.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) newOtp[i] = digits[i] || '';
      setOtpDigits(newOtp);
      if (digits.length === 6) verifyOtpCode(digits.join(''));
      return;
    }

    newOtp[index] = clean;
    setOtpDigits(newOtp);
    setOtpError('');

    if (clean && index < 5) otpInputRefs.current[index + 1]?.focus();
    if (clean && index === 5 && newOtp.join('').length === 6) {
      verifyOtpCode(newOtp.join(''));
    }
  };

  const verifyOtpCode = async (code: string) => {
    if (otpLoading || code.length !== 6) return;
    setOtpLoading(true);
    setOtpError('');

    try {
      await verifyOTPByToken(token, code);
      setTokenStatus('valid');
    } catch (err: any) {
      setOtpError(err?.response?.data?.detail || 'Invalid verification code.');
      setOtpDigits(Array(6).fill(''));
      otpInputRefs.current[0]?.focus();
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Clarification Handler ───────────────────────────────────────────────────
  const handleClarify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarifyQuery.trim() || isClarifying || !question) return;
    setIsClarifying(true);
    stopListening();

    try {
      const res = await clarifyQuestionByToken(token, question.question, clarifyQuery.trim());
      speak(res.ai_response, () => {
        if (isVoiceMode && !isMuted) startListening();
      });
    } catch {}
    setIsClarifying(false);
    setShowClarifyModal(false);
    setClarifyQuery('');
  };

  // ── Conclude Interview Handler ──────────────────────────────────────────────
  const handleConfirmFinish = async () => {
    setShowFinishConfirm(false);
    setGeneratingReport(true);
    stopListening();
    stopSpeaking();
    try {
      await finishInterviewByToken(token);
    } catch {}
    router.push(`/report/${token}`);
  };

  // ── Render States ───────────────────────────────────────────────────────────

  if (tokenStatus === 'checking') {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4">
        <LoadingState
          title="Verifying Interview Link"
          messages={[
            'Resolving secure interview invitation...',
            'Checking access permissions...',
            'Preparing personalized interview room...',
          ]}
        />
      </div>
    );
  }

  if (tokenStatus === 'invalid' || tokenStatus === 'expired') {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="glass-card max-w-md w-full p-8 text-center space-y-6 border border-red-500/30">
          <span className="text-4xl block">{tokenStatus === 'expired' ? '⏳' : '⚠️'}</span>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-[var(--text-primary)]">
              {tokenStatus === 'expired' ? 'Interview Link Expired' : 'Invalid Interview Link'}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {errorMessage || 'This invitation is no longer active. Please contact your recruiter or hiring manager.'}
            </p>
          </div>
          <button onClick={() => router.push('/')} className="btn-primary w-full py-3.5 text-xs font-bold">
            Return to Homepage ➔
          </button>
        </div>
      </div>
    );
  }

  if (tokenStatus === 'completed') {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="glass-card max-w-md w-full p-8 text-center space-y-6 border border-emerald-500/30">
          <span className="text-4xl block">🏆</span>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-[var(--text-primary)]">
              Interview Already Completed
            </h2>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              This interview has already been submitted. You can review the official ASHVANCE TECH assessment scorecard.
            </p>
          </div>
          <button onClick={() => router.push(`/report/${token}`)} className="btn-primary w-full py-3.5 text-xs font-bold">
            View Assessment Scorecard ➔
          </button>
        </div>
      </div>
    );
  }

  // OTP Verification Screen
  if (tokenStatus === 'otp_required') {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-8">
        <div className="glass-card max-w-md w-full p-8 space-y-6 border border-[var(--border)] text-center">
          <div className="bg-white p-1.5 rounded-xl shadow-sm border border-slate-200 inline-block">
            <Image src="/ashvance_logo.png" alt="ASHVANCE TECH" width={100} height={30} className="object-contain h-7 w-auto" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-black text-[var(--text-primary)]">
              Verify Your Identity
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Welcome, <strong className="text-[var(--text-primary)]">{candidateInfo?.name}</strong>. Enter your 6-digit OTP to unlock the interview.
            </p>
          </div>

          {otpError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-500 text-xs font-medium">
              {otpError}
            </div>
          )}

          <div className="flex justify-center gap-2">
            {otpDigits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpInputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                className="w-11 h-14 text-center font-mono font-bold text-2xl rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[var(--primary)] focus:outline-none"
              />
            ))}
          </div>

          <button
            onClick={() => verifyOtpCode(otpDigits.join(''))}
            disabled={otpLoading || otpDigits.join('').length !== 6}
            className="btn-primary w-full py-3.5 text-xs font-bold"
          >
            {otpLoading ? 'Verifying...' : 'Verify & Continue ➔'}
          </button>

          <button
            onClick={() => {
              setOtpDigits(['1', '2', '3', '4', '5', '6']);
              verifyOtpCode('123456');
            }}
            className="text-xs text-[var(--secondary)] hover:underline block mx-auto font-medium"
          >
            ⚡ Test Auto-Fill (123456)
          </button>
        </div>
      </div>
    );
  }

  // Pre-flight Device Check Screen
  if (!preflightDone) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-8">
        <div className="glass-card max-w-lg w-full p-8 space-y-6 border border-[var(--border)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--secondary)] uppercase block">
                DEVICE CHECK
              </span>
              <h2 className="text-2xl font-black text-[var(--text-primary)]">
                Pre-Flight Hardware Check
              </h2>
            </div>
            <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-200">
              <Image src="/ashvance_logo.png" alt="ASHVANCE TECH" width={80} height={24} className="object-contain h-6 w-auto" />
            </div>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Please allow microphone access to participate in the conversational voice interview for the <strong className="text-[var(--text-primary)]">{candidateInfo?.position}</strong> position.
          </p>

          <div className="space-y-3 bg-[var(--surface-secondary)] p-4 rounded-2xl border border-[var(--border)] text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span>🎙️</span>
                <span className="font-bold text-[var(--text-primary)]">Microphone Permission</span>
              </div>
              <span className={`font-mono font-bold ${micStatus === 'granted' ? 'text-emerald-500' : micStatus === 'denied' ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
                {micStatus === 'granted' ? '✓ Ready' : micStatus === 'denied' ? '✕ Denied' : '○ Pending'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span>🔊</span>
                <span className="font-bold text-[var(--text-primary)]">Audio Output</span>
              </div>
              <span className="font-mono font-bold text-emerald-500">✓ Ready</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span>🌐</span>
                <span className="font-bold text-[var(--text-primary)]">Internet Connection</span>
              </div>
              <span className={`font-mono font-bold ${networkStatus === 'online' ? 'text-emerald-500' : 'text-red-500'}`}>
                {networkStatus === 'online' ? '✓ Connected' : '✕ Offline'}
              </span>
            </div>
          </div>

          {micStatus === 'denied' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-xs text-red-500 space-y-1">
              <p className="font-bold">Microphone access was denied.</p>
              <p className="text-[11px] leading-relaxed">
                Please tap the lock/camera icon in your browser address bar and enable microphone access, then retry.
              </p>
            </div>
          )}

          <button
            onClick={runPreflightCheck}
            className="btn-primary w-full py-4 text-sm font-extrabold rounded-xl shadow-xl flex items-center justify-center gap-2"
          >
            <span>Start Voice Interview ➔</span>
          </button>
        </div>
      </div>
    );
  }

  if (generatingReport) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <LoadingState
          title="Synthesizing Assessment Report"
          messages={[
            'Analyzing verbal technical depth...',
            'Evaluating architectural trade-offs...',
            'Compiling official ASHVANCE TECH Scorecard...',
          ]}
        />
      </div>
    );
  }

  // Active Interview Studio
  const stageMeta = STAGE_META[currentStage] || STAGE_META.technical;
  const timerColor = timeLeft > 20 ? 'text-emerald-500' : timeLeft > 10 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="min-h-[88vh] flex flex-col justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-4 safe-bottom">
      
      {/* Network reconnection notice */}
      {isReconnecting && (
        <div className="bg-amber-500/20 border border-amber-500/40 rounded-xl p-3 text-center text-xs font-bold text-amber-400 animate-pulse">
          ⚠️ Connection interrupted. Reconnecting... Your interview progress is safely preserved.
        </div>
      )}

      {/* Header Bar */}
      <div className="glass-panel rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 border border-[var(--border)] shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="bg-white p-1 rounded-lg border border-slate-200 shrink-0">
            <Image src="/ashvance_logo.png" alt="ASHVANCE TECH" width={80} height={24} className="object-contain h-5 w-auto" />
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--text-primary)]">{candidateInfo?.name}</p>
            <p className="text-[10px] text-[var(--text-secondary)] font-mono">{candidateInfo?.position}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border bg-[var(--surface-hover)] ${stageMeta.color}`}>
            {stageMeta.icon} {stageMeta.label}
          </span>
          <button
            onClick={() => setShowFinishConfirm(true)}
            className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-bold"
          >
            🏁 Finish
          </button>
        </div>
      </div>

      {/* 2-Column Responsive Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-stretch">
        
        {/* Left: AI Orb & Question Card */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-4">
          
          {/* AI Central Orb */}
          <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-3 border border-[var(--border)]">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-600/40 to-cyan-500/40 border-2 border-cyan-400/60 shadow-2xl ai-orb-speaking">
              <span className="text-2xl">{aiState === 'listening' ? '🎙️' : aiState === 'speaking' ? '🗣️' : '✦'}</span>
            </div>
            <span className="text-xs font-bold tracking-wider uppercase text-[var(--accent-cyan)]">
              {aiState === 'listening' ? '🎙️ Listening to You...' : aiState === 'speaking' ? '🟣 AI Speaking...' : '🟢 AI Ready'}
            </span>
          </div>

          {/* Question Text */}
          {question && (
            <div className="glass-card p-6 space-y-3 flex-1 flex flex-col justify-center border border-[var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--secondary)] uppercase">
                  QUESTION {questionNum}
                </span>
                <span className="text-xs text-[var(--text-muted)] font-mono">Stage: {stageMeta.label}</span>
              </div>
              <p className="text-base sm:text-lg font-medium leading-relaxed text-[var(--text-primary)]">
                {question.question}
              </p>
              <button
                onClick={() => speak(question.question)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] text-left pt-1"
              >
                🔁 Replay audio
              </button>
            </div>
          )}

        </div>

        {/* Right: Response Studio */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          <div className="glass-card p-5 flex flex-col gap-3 flex-1 border border-[var(--border)]">
            
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <span className="text-xs font-bold text-[var(--text-primary)]">Live Answer Studio</span>
              {timerActive && (
                <span className={`font-mono text-xs font-bold ${timerColor}`}>
                  00:{String(timeLeft).padStart(2, '0')}
                </span>
              )}
            </div>

            {isVoiceMode ? (
              <div className="flex-1 min-h-[120px] p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text-primary)] flex flex-col justify-between">
                <p className="whitespace-pre-wrap leading-relaxed">
                  {liveTranscript || answer || (
                    <span className="text-[var(--text-muted)] italic">
                      {aiState === 'speaking' ? 'AI is speaking. Listening will begin automatically...' : 'Speak into your microphone. Auto-submits upon 2.4s silence.'}
                    </span>
                  )}
                </p>
                {isListening && (
                  <div className="pt-2 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                    <span>⚡ Auto-advance on silence</span>
                    <button
                      onClick={() => {
                        stopListening();
                        processSubmission(answerRef.current || answer);
                      }}
                      disabled={!answer.trim()}
                      className="text-xs font-bold text-[var(--primary)] hover:underline"
                    >
                      Submit Now ➔
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2">
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your response here..."
                  rows={6}
                  className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm p-3 focus:outline-none focus:border-[var(--border-focus)] resize-none"
                />
                <button
                  onClick={() => processSubmission(answer)}
                  disabled={!answer.trim()}
                  className="btn-primary w-full py-2.5 text-xs font-bold"
                >
                  Submit Answer ➔
                </button>
              </div>
            )}

            {/* Stage Checklist */}
            <div className="pt-2 border-t border-[var(--border)]">
              <span className="text-[9px] font-mono font-bold tracking-widest text-[var(--text-muted)] uppercase block mb-1">
                STAGES
              </span>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {STAGE_ORDER.map((s) => (
                  <div key={s} className={`truncate ${completedStages.includes(s) ? 'text-emerald-500 font-bold' : s === currentStage ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-muted)]'}`}>
                    {completedStages.includes(s) ? '✓ ' : s === currentStage ? '● ' : '○ '}
                    {STAGE_META[s]?.label}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Action Bar */}
          <div className="glass-panel rounded-2xl p-2.5 flex items-center justify-between gap-2 border border-[var(--border)]">
            <button
              onClick={() => setIsMuted((m) => !m)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-[var(--surface-hover)] text-[var(--text-secondary)]"
            >
              {isMuted ? '🔇 Muted' : '🔊 Voice'}
            </button>
            <button
              onClick={() => {
                setIsVoiceMode((v) => !v);
                stopListening();
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-[var(--surface-hover)] text-[var(--text-secondary)]"
            >
              {isVoiceMode ? '⌨️ Text' : '🎙️ Voice'}
            </button>
            <button
              onClick={() => setShowClarifyModal(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-[var(--surface-hover)] text-[var(--secondary)]"
            >
              💬 Clarify
            </button>
          </div>

        </div>

      </div>

      {/* Clarification Modal */}
      {showClarifyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 space-y-4 border border-[var(--border)]">
            <h3 className="text-base font-bold text-[var(--text-primary)]">Ask for Clarification</h3>
            <p className="text-xs text-[var(--text-secondary)]">Ask about scope or assumptions without affecting your evaluation score.</p>
            <form onSubmit={handleClarify} className="space-y-3">
              <input
                type="text"
                value={clarifyQuery}
                onChange={(e) => setClarifyQuery(e.target.value)}
                placeholder="e.g. Should I consider horizontal scaling?"
                className="input-field text-xs"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowClarifyModal(false)} className="btn-secondary text-xs px-3 py-2">
                  Cancel
                </button>
                <button type="submit" disabled={!clarifyQuery.trim() || isClarifying} className="btn-primary text-xs px-3 py-2">
                  {isClarifying ? 'Asking...' : 'Ask AI ➔'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Finish Confirm Modal */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 space-y-4 border border-[var(--border)] text-center">
            <span className="text-3xl block">🏁</span>
            <h3 className="text-lg font-black text-[var(--text-primary)]">Conclude Interview?</h3>
            <p className="text-xs text-[var(--text-secondary)]">Your responses will be compiled into the official ASHVANCE TECH assessment report.</p>
            <div className="flex justify-center gap-2 pt-2">
              <button onClick={() => setShowFinishConfirm(false)} className="btn-secondary text-xs px-4 py-2">
                Continue
              </button>
              <button onClick={handleConfirmFinish} className="btn-primary text-xs px-4 py-2">
                Conclude &amp; Score
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
