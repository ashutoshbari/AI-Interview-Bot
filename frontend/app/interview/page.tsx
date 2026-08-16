'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getQuestions,
  submitAnswer,
  transcribeAudio,
  recordWarning,
  clarifyQuestion,
  finishInterview,
  Question,
  EvaluationResponse
} from '@/lib/api';
import LoadingState from '@/components/LoadingState';

// ── Stage display map ─────────────────────────────────────────────────────────
const STAGE_META: Record<string, { label: string; icon: string; color: string }> = {
  greeting:   { label: 'Greeting',          icon: '👋', color: 'text-indigo-300' },
  background: { label: 'Background',        icon: '📋', color: 'text-blue-300' },
  project:    { label: 'Project Deep Dive', icon: '🏗️', color: 'text-purple-300' },
  technical:  { label: 'Technical Skills',  icon: '⚙️', color: 'text-cyan-300' },
  behavioral: { label: 'Behavioral',        icon: '🤝', color: 'text-amber-300' },
  closing:    { label: 'Closing',           icon: '🎯', color: 'text-emerald-300' },
  general:    { label: 'General',           icon: '💡', color: 'text-white/60' },
};

const STAGE_ORDER = ['greeting', 'background', 'project', 'technical', 'behavioral', 'closing'];

// ── AI state type ─────────────────────────────────────────────────────────────
type AIState = 'ready' | 'speaking' | 'listening' | 'thinking' | 'processing';

const RESPONSE_SECONDS = 60;

// ── Silence detection config ──────────────────────────────────────────────────
const SILENCE_TIMEOUT_MS = 2500;  // 2.5s of silence → auto-submit
const MIN_SPEECH_LENGTH  = 15;    // Minimum chars before silence triggers submit

function InterviewContent() {
  const router = useRouter();
  const params = useSearchParams();
  const candidateId    = Number(params.get('candidateId'));
  const candidateName  = decodeURIComponent(params.get('name') || 'Candidate');
  const totalQuestions = Number(params.get('total') || 12);

  // ── Core state ───────────────────────────────────────────────────────────────
  const [question, setQuestion]         = useState<Question | null>(null);
  const [questionNum, setQuestionNum]   = useState(1);
  const [answer, setAnswer]             = useState('');
  const [aiState, setAiState]           = useState<AIState>('ready');
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [isComplete, setIsComplete]     = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // ── Timer state ───────────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft]           = useState(RESPONSE_SECONDS);
  const [timerActive, setTimerActive]     = useState(false);
  const [silencePromptShown, setSilencePromptShown] = useState(false);

  // ── Voice state ───────────────────────────────────────────────────────────────
  const [isVoiceMode, setIsVoiceMode]     = useState(true);
  const [isMuted, setIsMuted]             = useState(false);
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [micError, setMicError]           = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isListening, setIsListening]     = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────────
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [clarifyQuery, setClarifyQuery]   = useState('');
  const [clarifyResponse, setClarifyResponse] = useState('');
  const [isClarifying, setIsClarifying]   = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [currentStage, setCurrentStage]   = useState('greeting');
  const [cheatWarning, setCheatWarning]   = useState('');
  const [orbWave, setOrbWave]             = useState(0);

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const recognitionRef       = useRef<any>(null);
  const timerRef             = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef      = useRef(false);   // Guard against duplicate submissions
  const isFetchingRef        = useRef(false);   // Guard against duplicate fetches
  const lastSpeechTimeRef    = useRef<number>(0);
  const answerRef            = useRef('');       // For closure-safe access in timers
  const currentQuestionRef   = useRef<Question | null>(null);
  const orbAnimRef           = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep refs in sync with state
  useEffect(() => { answerRef.current = answer; }, [answer]);
  useEffect(() => { currentQuestionRef.current = question; }, [question]);

  // ── Orb animation ──────────────────────────────────────────────────────────
  useEffect(() => {
    orbAnimRef.current = setInterval(() => {
      setOrbWave(prev => (prev + 1) % 360);
    }, 50);
    return () => { if (orbAnimRef.current) clearInterval(orbAnimRef.current); };
  }, []);

  // ── TTS — speak using browser speech synthesis ───────────────────────────────
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || isMuted) {
      if (onEnd) onEnd();
      return;
    }

    window.speechSynthesis.cancel();
    setAiState('speaking');

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();

      const femaleVoice = voices.find(v =>
        (v.name.includes('Zira') || v.name.includes('Samantha') ||
         v.name.includes('Victoria') || v.name.includes('Karen') ||
         v.name.includes('Google US English') || v.name.includes('Jenny') ||
         v.name.includes('Aria') || (v.name.includes('Female') && v.lang.startsWith('en')))
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.pitch = 1.1;
      utterance.rate  = 0.92;

      utterance.onend = () => {
        setAiState('ready');
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        setAiState('ready');
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    }, 100);
  }, [isMuted]);

  // Stop TTS (barge-in support)
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setAiState('ready');
    }
  }, []);

  // ── Microphone / Speech Recognition ─────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    if (isProcessingRef.current) return;

    setMicError('');
    setLiveTranscript('');
    setAnswer('');
    answerRef.current = '';
    lastSpeechTimeRef.current = Date.now();

    // Start response countdown timer
    setTimeLeft(RESPONSE_SECONDS);
    setTimerActive(true);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError('Voice recognition not supported in this browser. Please type your answer.');
      setIsVoiceMode(false);
      return;
    }

    try {
      // Request mic permission if not yet granted
      if (micPermission !== 'granted') {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicPermission('granted');
      }
    } catch {
      setMicPermission('denied');
      setMicError('Microphone access denied. Please allow microphone and reload.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous    = true;
    recognition.interimResults = true;
    recognition.lang           = 'en-IN';   // Indian English

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
        lastSpeechTimeRef.current = Date.now();
        // Reset silence detection timer
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          // Auto-submit after silence
          if (answerRef.current.trim().length > MIN_SPEECH_LENGTH && !isProcessingRef.current) {
            stopListening();
            handleAutoSubmit();
          }
        }, SILENCE_TIMEOUT_MS);
      }
    };

    recognition.onerror = (err: any) => {
      if (err.error === 'not-allowed') {
        setMicPermission('denied');
        setMicError('Microphone access denied. Please allow and reload.');
      } else if (err.error !== 'no-speech') {
        console.warn('Speech recognition error:', err.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still in listening mode and not processing
      if (isListening && !isProcessingRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    setAiState('listening');

    try { recognition.start(); } catch (e) {
      console.warn('Recognition start error:', e);
    }
  }, [micPermission, isListening, stopListening, isMuted]);

  // ── Barge-in: if user speaks while AI is speaking, stop TTS ─────────────────
  useEffect(() => {
    if (isListening && aiState === 'speaking') {
      stopSpeaking();
    }
  }, [isListening, aiState, stopSpeaking]);

  // ── Response timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerActive) return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimerActive(false);
          if (!isProcessingRef.current) {
            if (!silencePromptShown && !answerRef.current.trim()) {
              // Give a grace nudge before marking timeout
              setSilencePromptShown(true);
              speak("Are you still there? Take your time, I'm listening.", () => {
                // After nudge, give 20 more seconds
                setTimeLeft(20);
                setTimerActive(true);
              });
            } else {
              handleAutoSubmit();
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current!); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerActive]);

  // ── Fetch first/current question ──────────────────────────────────────────────
  const fetchQuestion = useCallback(async () => {
    if (!candidateId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const qs = await getQuestions(candidateId);
      if (qs && qs.length > 0) {
        const q = qs[0];
        setQuestion(q);
        setQuestionNum(q.question_order);
        setCurrentStage(q.stage || 'greeting');

        // Auto-speak the first question
        if (isVoiceMode) {
          speak(q.question, () => {
            if (!isMuted) startListening();
          });
        }
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Could not load interview question. Please retry.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [candidateId, isVoiceMode, speak, startListening, isMuted]);

  useEffect(() => {
    fetchQuestion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Run ONCE on mount — NOT inside fetchQ's deps to prevent re-fetches

  // ── Process answer submission ──────────────────────────────────────────────────
  const processSubmission = useCallback(async (submittedAnswer: string) => {
    if (isProcessingRef.current || !currentQuestionRef.current) return;
    if (!submittedAnswer.trim()) {
      submittedAnswer = '[No answer provided — time expired]';
    }

    isProcessingRef.current = true;
    stopListening();
    setTimerActive(false);
    setAiState('thinking');
    setError('');

    try {
      const result = await submitAnswer(
        candidateId,
        currentQuestionRef.current.question_order,
        submittedAnswer
      );

      setAiState('processing');

      if (result.interview_complete || !result.next_question) {
        setIsComplete(true);
        // Mark all stages done
        setCompletedStages(STAGE_ORDER);
        speak("Thank you for completing the interview. I'll now generate your comprehensive scorecard.", () => {
          setGeneratingReport(true);
          setTimeout(() => {
            router.push(`/report?candidateId=${candidateId}&name=${encodeURIComponent(candidateName)}`);
          }, 1200);
        });
      } else {
        const nextQ = result.next_question;
        // Mark current stage as completed
        setCompletedStages(prev =>
          prev.includes(currentStage) ? prev : [...prev, currentStage]
        );

        setQuestion(nextQ);
        setQuestionNum(nextQ.question_order);
        setCurrentStage(nextQ.stage || 'technical');
        setAnswer('');
        setLiveTranscript('');
        setSilencePromptShown(false);

        // AI speaks the next question, then auto-listens
        speak(nextQ.question, () => {
          if (isVoiceMode && !isMuted) {
            startListening();
          }
        });
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Could not evaluate answer. Please retry.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setAiState('ready');
    } finally {
      isProcessingRef.current = false;
    }
  }, [
    candidateId, candidateName, currentStage, isVoiceMode, isMuted,
    speak, startListening, stopListening, router
  ]);

  // ── Auto-submit (timer/silence) ────────────────────────────────────────────────
  const handleAutoSubmit = useCallback(() => {
    processSubmission(answerRef.current);
  }, [processSubmission]);

  // ── Manual text submit ────────────────────────────────────────────────────────
  const handleTextSubmit = () => {
    if (!answer.trim() || isProcessingRef.current) return;
    processSubmission(answer.trim());
  };

  // ── Manual voice submit (from button) ────────────────────────────────────────
  const handleManualVoiceSubmit = () => {
    if (isProcessingRef.current) return;
    stopListening();
    processSubmission(answerRef.current || answer);
  };

  // ── Clarification ─────────────────────────────────────────────────────────────
  const handleAskClarification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarifyQuery.trim() || isClarifying || !question) return;
    setIsClarifying(true);
    setClarifyResponse('');

    try {
      const res = await clarifyQuestion(candidateId, question.question, clarifyQuery.trim());
      setClarifyResponse(res.ai_response);
      // Speak the clarification then return to listening mode
      speak(res.ai_response, () => {
        if (isVoiceMode && !isMuted) startListening();
      });
    } catch {
      setClarifyResponse('Feel free to proceed with standard industry assumptions.');
    } finally {
      setIsClarifying(false);
      setShowClarifyModal(false);
      setClarifyQuery('');
    }
  };

  // ── Finish interview ──────────────────────────────────────────────────────────
  const handleConfirmFinish = async () => {
    setShowFinishConfirm(false);
    setGeneratingReport(true);
    stopListening();
    stopSpeaking();
    try { await finishInterview(candidateId); } catch {}
    router.push(`/report?candidateId=${candidateId}&name=${encodeURIComponent(candidateName)}`);
  };

  // ── Anti-cheat ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onVisibilityChange = async () => {
      if (document.hidden && !isComplete && !generatingReport) {
        setCheatWarning('⚠️ Tab switching is monitored and logged for proctoring compliance.');
        try { await recordWarning(candidateId, 'tab_switch'); } catch {}
        setTimeout(() => setCheatWarning(''), 5000);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [candidateId, isComplete, generatingReport]);

  // Cleanup on unmount
  useEffect(() => () => {
    stopListening();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    if (orbAnimRef.current) clearInterval(orbAnimRef.current);
  }, [stopListening]);

  // ── Computed values ────────────────────────────────────────────────────────────
  const progressPercent = Math.min(100, Math.round((questionNum / Math.max(totalQuestions, 10)) * 100));
  const stageMeta       = STAGE_META[currentStage] || STAGE_META.general;
  const timerColor      = timeLeft > 30 ? 'text-emerald-400' : timeLeft > 10 ? 'text-amber-400' : 'text-red-400';
  const timerPct        = (timeLeft / RESPONSE_SECONDS) * 100;

  // ── Orb visual config ─────────────────────────────────────────────────────────
  const orbConfig = {
    ready:      { bg: 'from-slate-700/60 to-slate-800/60', glow: 'shadow-slate-500/20',   pulse: false, ring: 'border-slate-600/40', label: '🟢 Ready', labelColor: 'text-emerald-400' },
    speaking:   { bg: 'from-purple-600/40 to-violet-700/40', glow: 'shadow-purple-500/40', pulse: true,  ring: 'border-purple-400/60', label: '🟣 AI Speaking', labelColor: 'text-purple-300' },
    listening:  { bg: 'from-blue-600/40 to-cyan-700/40',   glow: 'shadow-cyan-500/40',   pulse: true,  ring: 'border-cyan-400/60',   label: '🔵 Listening…', labelColor: 'text-cyan-300' },
    thinking:   { bg: 'from-amber-600/30 to-yellow-700/30', glow: 'shadow-amber-500/30', pulse: true,  ring: 'border-amber-400/60',  label: '🟡 AI Thinking…', labelColor: 'text-amber-300' },
    processing: { bg: 'from-indigo-600/30 to-blue-700/30', glow: 'shadow-indigo-500/30', pulse: true,  ring: 'border-indigo-400/60', label: '⚙️ Processing…', labelColor: 'text-indigo-300' },
  }[aiState];

  // ── Loading screens ────────────────────────────────────────────────────────────
  if (generatingReport) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <LoadingState
          title="Synthesizing Your Scorecard"
          messages={[
            "Evaluating technical depth across all answers…",
            "Analyzing communication style and problem-solving…",
            "Generating personalized improvement roadmap…",
            "Finalizing your scorecard…"
          ]}
        />
      </div>
    );
  }

  if (loading && !question) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <LoadingState
          title="Preparing Your AI Interview"
          messages={[
            "Loading your candidate profile…",
            "Analyzing your resume…",
            "Calibrating question strategy…",
            "AI interviewer ready…"
          ]}
        />
      </div>
    );
  }

  if (error && !question) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div className="glass-card max-w-md w-full p-8">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Interview Interrupted</h2>
          <p className="text-red-300/80 text-sm mb-6">{error}</p>
          <button onClick={fetchQuestion} className="btn-primary w-full py-3">🔄 Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #060B16 0%, #0B0F1A 50%, #080C17 100%)' }}>

      {/* ── Background mesh ──────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #06B6D4 0%, transparent 70%)' }} />
      </div>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 backdrop-blur-xl"
        style={{ background: 'rgba(6,11,22,0.8)' }}>
        <div className="flex items-center gap-3">
          <span className="text-lg font-black bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            ✨ Smart Interview AI
          </span>
          <span className="text-white/20">|</span>
          <span className="text-white/50 text-sm">{candidateName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-3 py-1 rounded-full border backdrop-blur-sm ${stageMeta.color} border-white/10 bg-white/5`}>
            {stageMeta.icon} {stageMeta.label}
          </span>
          <span className="font-mono text-white/40 text-xs">Q {questionNum} / ~{totalQuestions}</span>
          <button
            onClick={() => setShowFinishConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all"
          >
            🏁 Finish
          </button>
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 px-6 pt-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between text-xs text-white/30 mb-1.5">
            <span>Interview Progress</span>
            <span className="font-mono">{progressPercent}%</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #7C3AED, #06B6D4)' }}
            />
          </div>
        </div>
      </div>

      {/* ── Main content area ─────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row gap-6 px-6 py-6 max-w-6xl mx-auto w-full">

        {/* ── Left: AI Orb + Question ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-5">

          {/* Cheat warning */}
          {cheatWarning && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-red-300 text-sm font-medium">
              {cheatWarning}
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-red-300 text-sm">{error}</p>
              <button onClick={() => setError('')} className="text-red-400 text-xs font-bold">✕</button>
            </div>
          )}

          {/* AI Orb */}
          <div className="flex flex-col items-center gap-4 py-4">
            {/* Orb */}
            <div className="relative flex items-center justify-center">
              {/* Outer glow rings */}
              {orbConfig.pulse && (
                <>
                  <div className="absolute w-48 h-48 rounded-full animate-ping opacity-10"
                    style={{ background: aiState === 'speaking' ? '#7C3AED' : aiState === 'listening' ? '#06B6D4' : '#F59E0B', animationDuration: '2s' }} />
                  <div className="absolute w-40 h-40 rounded-full animate-pulse opacity-15"
                    style={{ background: aiState === 'speaking' ? '#7C3AED' : aiState === 'listening' ? '#06B6D4' : '#F59E0B' }} />
                </>
              )}

              {/* Main orb */}
              <div className={`relative w-32 h-32 rounded-full flex items-center justify-center border-2 ${orbConfig.ring} shadow-2xl ${orbConfig.glow} transition-all duration-500 bg-gradient-to-br ${orbConfig.bg}`}>
                {/* Waveform bars inside orb */}
                <div className="flex items-center gap-1 h-10">
                  {[...Array(7)].map((_, i) => {
                    const height = aiState === 'listening'
                      ? `${20 + Math.abs(Math.sin((orbWave + i * 45) * Math.PI / 180)) * 28}px`
                      : aiState === 'speaking'
                      ? `${15 + Math.abs(Math.sin((orbWave + i * 35) * Math.PI / 180)) * 25}px`
                      : aiState === 'thinking' || aiState === 'processing'
                      ? `${12 + Math.abs(Math.sin((orbWave * 2 + i * 60) * Math.PI / 180)) * 15}px`
                      : '8px';
                    const color = aiState === 'listening' ? '#06B6D4' : aiState === 'speaking' ? '#A855F7' : '#F59E0B';
                    return (
                      <div key={i} className="rounded-full w-1.5 transition-all duration-75"
                        style={{ height, backgroundColor: color, opacity: aiState === 'ready' ? 0.3 : 0.85 }} />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* AI state label */}
            <span className={`text-sm font-bold tracking-wide ${orbConfig.labelColor}`}>
              {orbConfig.label}
            </span>
          </div>

          {/* Question card */}
          {question && (
            <div className="rounded-2xl border border-white/10 p-6"
              style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold text-white/30 uppercase tracking-widest">Question {questionNum}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border bg-white/5 ${stageMeta.color} border-white/10`}>
                  {stageMeta.icon} {stageMeta.label}
                </span>
              </div>
              <p className="text-white text-lg sm:text-xl font-medium leading-relaxed">
                {question.question}
              </p>
              {/* Replay button */}
              <button
                onClick={() => speak(question.question)}
                disabled={aiState === 'speaking'}
                className="mt-4 text-xs text-white/30 hover:text-purple-300 transition-colors flex items-center gap-1.5"
              >
                🔊 Replay question
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Response + Controls ────────────────────────────────────────── */}
        <div className="lg:w-96 flex flex-col gap-4">

          {/* Listening / transcript area */}
          {isVoiceMode ? (
            <div className="rounded-2xl border border-white/10 p-5 flex flex-col gap-4"
              style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)' }}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${aiState === 'listening' ? 'text-cyan-300' : 'text-white/40'}`}>
                  {aiState === 'listening' ? '🎙 Listening…' :
                   aiState === 'thinking'  ? '🟡 Processing your answer…' :
                   aiState === 'speaking'  ? '🟣 AI is speaking…' :
                   '🎙 Your Response'}
                </span>
                {/* 60-second timer */}
                {timerActive && (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${timerPct}%`, background: timeLeft > 30 ? '#10B981' : timeLeft > 10 ? '#F59E0B' : '#EF4444' }} />
                    </div>
                    <span className={`font-mono text-xs font-bold ${timerColor}`}>
                      {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>

              {/* Live transcript */}
              <div className="min-h-[100px] rounded-xl border border-white/8 p-3 text-sm text-white/70 leading-relaxed"
                style={{ background: 'rgba(0,0,0,0.2)' }}>
                {liveTranscript || answer ? (
                  <p className="whitespace-pre-wrap">{liveTranscript || answer}</p>
                ) : (
                  <p className="text-white/25 italic">
                    {aiState === 'speaking' ? 'Listening begins after AI finishes speaking…' :
                     aiState === 'listening' ? 'Speak naturally. Your words appear here.' :
                     'Waiting…'}
                  </p>
                )}
              </div>

              {/* Voice controls */}
              <div className="flex gap-2 flex-wrap">
                {!isListening && aiState === 'ready' && !isProcessingRef.current && (
                  <button onClick={startListening}
                    className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 transition-all">
                    🎙 Start Speaking
                  </button>
                )}
                {isListening && (
                  <button onClick={handleManualVoiceSubmit}
                    disabled={!answer.trim()}
                    className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold bg-purple-500/25 hover:bg-purple-500/35 border border-purple-500/40 text-purple-200 transition-all disabled:opacity-40">
                    ✓ Submit Answer
                  </button>
                )}
                {micError && <p className="w-full text-red-400 text-xs">{micError}</p>}
              </div>
            </div>
          ) : (
            /* Text mode */
            <div className="rounded-2xl border border-white/10 p-5 flex flex-col gap-3"
              style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)' }}>
              <label className="text-sm font-semibold text-white/60">Type Your Answer</label>
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Provide a detailed, structured response…"
                rows={8}
                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm p-4 resize-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 leading-relaxed"
                disabled={isProcessingRef.current}
              />
              <button
                onClick={handleTextSubmit}
                disabled={!answer.trim() || isProcessingRef.current}
                className="py-3 px-6 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white transition-all disabled:opacity-40 shadow-lg"
              >
                {isProcessingRef.current ? 'Evaluating…' : 'Submit Answer ➔'}
              </button>
            </div>
          )}

          {/* ── Conversation Timeline ──────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/10 p-5"
            style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)' }}>
            <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Interview Progress</p>
            <div className="flex flex-col gap-2">
              {STAGE_ORDER.map(s => {
                const meta   = STAGE_META[s];
                const done   = completedStages.includes(s);
                const active = s === currentStage;
                return (
                  <div key={s} className={`flex items-center gap-2.5 text-xs font-medium transition-all ${done ? 'text-white/70' : active ? 'text-white' : 'text-white/25'}`}>
                    <span>{done ? '✅' : active ? '●' : '○'}</span>
                    <span>{meta.icon} {meta.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Bottom controls ────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/10 p-4 flex items-center justify-between gap-2"
            style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)' }}>
            {/* Mute */}
            <button
              onClick={() => { setIsMuted(m => !m); if (!isMuted) stopSpeaking(); }}
              className={`p-2.5 rounded-xl text-sm border transition-all ${isMuted ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
              title={isMuted ? 'Unmute AI' : 'Mute AI'}
            >{isMuted ? '🔇' : '🔊'}</button>

            {/* Repeat */}
            <button
              onClick={() => question && speak(question.question)}
              disabled={aiState === 'speaking' || !question}
              className="p-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all disabled:opacity-30"
              title="Repeat question"
            >🔁</button>

            {/* Voice/Text toggle */}
            <button
              onClick={() => { setIsVoiceMode(v => !v); stopListening(); setAnswer(''); }}
              className={`p-2.5 rounded-xl text-sm border transition-all ${isVoiceMode ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-white/5 border-white/10 text-white/40'}`}
              title={isVoiceMode ? 'Switch to text' : 'Switch to voice'}
            >{isVoiceMode ? '🎙' : '⌨️'}</button>

            {/* Ask AI clarification */}
            <button
              onClick={() => { setShowClarifyModal(true); setClarifyResponse(''); }}
              disabled={aiState === 'thinking' || aiState === 'processing'}
              className="p-2.5 rounded-xl text-sm bg-cyan-500/10 border border-cyan-500/20 text-cyan-300/60 hover:text-cyan-300 transition-all disabled:opacity-30"
              title="Ask AI for clarification"
            >💬</button>

            {/* End interview */}
            <button
              onClick={() => setShowFinishConfirm(true)}
              className="p-2.5 rounded-xl text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-300/60 hover:text-emerald-300 transition-all"
              title="End interview"
            >🏁</button>
          </div>
        </div>
      </div>

      {/* ── Clarification modal ───────────────────────────────────────────────── */}
      {showClarifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg">
          <div className="max-w-lg w-full rounded-3xl border border-cyan-500/30 p-6 shadow-2xl space-y-4"
            style={{ background: 'rgba(6,11,22,0.95)' }}>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">💬 Ask AI for Clarification</h3>
              <button onClick={() => setShowClarifyModal(false)} className="text-white/30 hover:text-white text-xl">✕</button>
            </div>
            <p className="text-white/40 text-xs">
              Ask about the current question. AI will answer briefly and return to the interview.
            </p>
            <form onSubmit={handleAskClarification} className="space-y-3">
              <textarea
                value={clarifyQuery}
                onChange={e => setClarifyQuery(e.target.value)}
                placeholder="e.g., What do you mean by inference optimization?"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm p-3 resize-none focus:outline-none focus:border-cyan-500/50"
                disabled={isClarifying}
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowClarifyModal(false)}
                  className="px-4 py-2 text-xs rounded-xl bg-white/5 text-white/40 hover:text-white border border-white/10">
                  Cancel
                </button>
                <button type="submit" disabled={isClarifying || !clarifyQuery.trim()}
                  className="px-5 py-2 text-xs rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 font-bold disabled:opacity-40">
                  {isClarifying ? 'AI Thinking…' : 'Ask ➔'}
                </button>
              </div>
            </form>
            {clarifyResponse && (
              <div className="bg-cyan-950/40 border border-cyan-500/20 rounded-xl p-4 text-cyan-100 text-sm leading-relaxed">
                {clarifyResponse}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Finish confirmation modal ──────────────────────────────────────────── */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg">
          <div className="max-w-md w-full rounded-3xl border border-emerald-500/30 p-8 text-center shadow-2xl space-y-5"
            style={{ background: 'rgba(6,11,22,0.95)' }}>
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-3xl">🏁</div>
            <h3 className="text-xl font-bold text-white">Finish Interview?</h3>
            <p className="text-white/40 text-sm">
              Your scorecard will be generated and emailed to you.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowFinishConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-sm font-bold transition-all">
                Keep Going
              </button>
              <button onClick={handleConfirmFinish}
                className="flex-1 py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-sm font-bold transition-all">
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex gap-2">
          {[0, 0.2, 0.4].map((d, i) => (
            <span key={i} className="w-3 h-3 rounded-full bg-purple-400 animate-bounce"
              style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
    }>
      <InterviewContent />
    </Suspense>
  );
}
