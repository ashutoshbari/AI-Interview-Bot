'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  getQuestions,
  submitAnswer,
  recordWarning,
  clarifyQuestion,
  finishInterview,
  Question,
} from '@/lib/api';
import LoadingState from '@/components/LoadingState';

// ── Multi-Stage State Machine Map ─────────────────────────────────────────────
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
const SILENCE_TIMEOUT_MS = 2400; // 2.4s natural silence detection
const MIN_SPEECH_LENGTH = 12;

function InterviewContent() {
  const router = useRouter();
  const params = useSearchParams();
  const candidateId = Number(params.get('candidateId'));
  const candidateName = decodeURIComponent(params.get('name') || 'Candidate');
  const totalQuestions = Number(params.get('total') || 12);

  // ── Core State ───────────────────────────────────────────────────────────────
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionNum, setQuestionNum] = useState(1);
  const [answer, setAnswer] = useState('');
  const [aiState, setAiState] = useState<AIState>('idle');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // ── Timer State ──────────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(RESPONSE_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const [silencePromptShown, setSilencePromptShown] = useState(false);

  // ── Voice & Audio State ──────────────────────────────────────────────────────
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);

  // ── UI Modal & Flow State ────────────────────────────────────────────────────
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [clarifyQuery, setClarifyQuery] = useState('');
  const [clarifyResponse, setClarifyResponse] = useState('');
  const [isClarifying, setIsClarifying] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [currentStage, setCurrentStage] = useState('greeting');
  const [cheatWarning, setCheatWarning] = useState('');
  const [orbWave, setOrbWave] = useState(0);

  // ── Thread-Safe Refs ─────────────────────────────────────────────────────────
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastSpeechTimeRef = useRef<number>(0);
  const answerRef = useRef('');
  const currentQuestionRef = useRef<Question | null>(null);
  const orbAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);
  useEffect(() => {
    currentQuestionRef.current = question;
  }, [question]);

  // Orb animation wave counter
  useEffect(() => {
    orbAnimRef.current = setInterval(() => {
      setOrbWave((prev) => (prev + 1) % 360);
    }, 45);
    return () => {
      if (orbAnimRef.current) clearInterval(orbAnimRef.current);
    };
  }, []);

  // ── TTS: Autonomous AI Speech ────────────────────────────────────────────────
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
          voices.find(
            (v) =>
              v.name.includes('Samantha') ||
              v.name.includes('Victoria') ||
              v.name.includes('Karen') ||
              v.name.includes('Zira') ||
              v.name.includes('Google US English') ||
              v.name.includes('Aria') ||
              (v.name.includes('Female') && v.lang.startsWith('en'))
          ) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          voices[0];

        if (naturalVoice) utterance.voice = naturalVoice;
        utterance.pitch = 1.05;
        utterance.rate = 0.94;

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

  // ── Microphone & Automatic Speech Recognition ────────────────────────────────
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
    lastSpeechTimeRef.current = Date.now();

    // Start 60s response timer
    setTimeLeft(RESPONSE_SECONDS);
    setTimerActive(true);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsVoiceMode(false);
      return;
    }

    try {
      if (micPermission !== 'granted') {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicPermission('granted');
      }
    } catch {
      setMicPermission('denied');
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
        lastSpeechTimeRef.current = Date.now();
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        // Natural silence detection
        silenceTimerRef.current = setTimeout(() => {
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
        setIsVoiceMode(false);
      }
    };

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
  }, [micPermission, isListening, stopListening]);

  // Barge-in: Candidate interruption stops AI speaking
  useEffect(() => {
    if (isListening && aiState === 'speaking') {
      stopSpeaking();
    }
  }, [isListening, aiState, stopSpeaking]);

  // ── Response Timer with Grace Prompt ─────────────────────────────────────────
  useEffect(() => {
    if (!timerActive) return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimerActive(false);

          if (!isProcessingRef.current) {
            if (!silencePromptShown && !answerRef.current.trim()) {
              setSilencePromptShown(true);
              speak("Take your time. I'm listening.", () => {
                setTimeLeft(25);
                setTimerActive(true);
                if (isVoiceMode && !isMuted) startListening();
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

    return () => {
      if (timerRef.current) clearInterval(timerRef.current!);
    };
  }, [timerActive, silencePromptShown, isVoiceMode, isMuted, speak, startListening]);

  // ── Load First / Active Question ─────────────────────────────────────────────
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

        // Automatically speak question, then automatically start listening
        if (isVoiceMode) {
          speak(q.question, () => {
            if (!isMuted) startListening();
          });
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || "We're reconnecting your AI interviewer. Your progress is safe.");
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [candidateId, isVoiceMode, speak, startListening, isMuted]);

  useEffect(() => {
    fetchQuestion();
  }, []);

  // ── Answer Processing Loop ───────────────────────────────────────────────────
  const processSubmission = useCallback(
    async (submittedAnswer: string) => {
      if (isProcessingRef.current || !currentQuestionRef.current) return;
      if (!submittedAnswer.trim()) {
        submittedAnswer = '[No answer provided — response interval elapsed]';
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
          setCompletedStages(STAGE_ORDER);
          speak(
            "Thank you for completing your interview with ASHVANCE TECH. I will now generate your comprehensive scorecard and assessment report.",
            () => {
              setGeneratingReport(true);
              setTimeout(() => {
                router.push(
                  `/report?candidateId=${candidateId}&name=${encodeURIComponent(candidateName)}`
                );
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
          setSilencePromptShown(false);

          // AI speaks next question -> automatically listens
          speak(nextQ.question, () => {
            if (isVoiceMode && !isMuted) {
              startListening();
            }
          });
        }
      } catch (e: any) {
        setError("We're reconnecting your AI interviewer. Your interview progress is safe.");
        setAiState('idle');
      } finally {
        isProcessingRef.current = false;
      }
    },
    [
      candidateId,
      candidateName,
      currentStage,
      isVoiceMode,
      isMuted,
      speak,
      startListening,
      stopListening,
      router,
    ]
  );

  const handleAutoSubmit = useCallback(() => {
    processSubmission(answerRef.current);
  }, [processSubmission]);

  const handleTextSubmit = () => {
    if (!answer.trim() || isProcessingRef.current) return;
    processSubmission(answer.trim());
  };

  const handleManualVoiceSubmit = () => {
    if (isProcessingRef.current) return;
    stopListening();
    processSubmission(answerRef.current || answer);
  };

  // ── Candidate Clarification Mode ─────────────────────────────────────────────
  const handleAskClarification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarifyQuery.trim() || isClarifying || !question) return;
    setIsClarifying(true);
    setClarifyResponse('');
    stopListening();

    try {
      const res = await clarifyQuestion(candidateId, question.question, clarifyQuery.trim());
      setClarifyResponse(res.ai_response);

      // AI speaks concise clarification, then re-engages listening for the main question
      speak(res.ai_response, () => {
        if (isVoiceMode && !isMuted) startListening();
      });
    } catch {
      setClarifyResponse('Feel free to proceed with standard production assumptions.');
    } finally {
      setIsClarifying(false);
      setShowClarifyModal(false);
      setClarifyQuery('');
    }
  };

  // ── Explicit Finish ──────────────────────────────────────────────────────────
  const handleConfirmFinish = async () => {
    setShowFinishConfirm(false);
    setGeneratingReport(true);
    stopListening();
    stopSpeaking();
    try {
      await finishInterview(candidateId);
    } catch {}
    router.push(`/report?candidateId=${candidateId}&name=${encodeURIComponent(candidateName)}`);
  };

  // ── Anti-Cheat Monitor ───────────────────────────────────────────────────────
  useEffect(() => {
    const onVisibilityChange = async () => {
      if (document.hidden && !isComplete && !generatingReport) {
        setCheatWarning('⚠️ Proctoring Notice: Focus maintained. Tab switching is logged for evaluation.');
        try {
          await recordWarning(candidateId, 'tab_switch');
        } catch {}
        setTimeout(() => setCheatWarning(''), 5000);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [candidateId, isComplete, generatingReport]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
      if (orbAnimRef.current) clearInterval(orbAnimRef.current);
    };
  }, [stopListening]);

  // ── Computed Progress & State ────────────────────────────────────────────────
  const progressPercent = Math.min(100, Math.round((questionNum / Math.max(totalQuestions, 10)) * 100));
  const stageMeta = STAGE_META[currentStage] || STAGE_META.technical;
  const timerColor = timeLeft > 25 ? 'text-emerald-500' : timeLeft > 10 ? 'text-amber-500' : 'text-red-500';
  const timerPct = (timeLeft / RESPONSE_SECONDS) * 100;

  // AI Orb state visual config
  const orbConfig = {
    idle: {
      bg: 'from-slate-700/40 to-slate-800/40',
      glow: 'shadow-slate-500/20',
      ring: 'border-slate-500/30',
      label: '🟢 AI Interviewer Ready',
      labelColor: 'text-emerald-400',
    },
    speaking: {
      bg: 'from-purple-600/50 to-indigo-700/50',
      glow: 'shadow-purple-500/50',
      ring: 'border-purple-400/80',
      label: '🟣 AI is Speaking...',
      labelColor: 'text-purple-400 font-bold',
    },
    listening: {
      bg: 'from-cyan-600/40 to-blue-700/40',
      glow: 'shadow-cyan-500/50',
      ring: 'border-cyan-400/80',
      label: '🎙️ Listening to You...',
      labelColor: 'text-cyan-400 font-bold',
    },
    thinking: {
      bg: 'from-amber-600/40 to-yellow-700/40',
      glow: 'shadow-amber-500/40',
      ring: 'border-amber-400/80',
      label: '🟡 Synthesizing Context...',
      labelColor: 'text-amber-400 font-bold',
    },
    processing: {
      bg: 'from-indigo-600/40 to-cyan-700/40',
      glow: 'shadow-indigo-500/40',
      ring: 'border-indigo-400/80',
      label: '⚙️ Evaluating Response...',
      labelColor: 'text-indigo-400 font-bold',
    },
  }[aiState];

  if (generatingReport) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <LoadingState
          title="Synthesizing ASHVANCE TECH Scorecard"
          messages={[
            'Evaluating architectural and technical depth...',
            'Analyzing verbal clarity and problem decomposition...',
            'Applying corporate assessment rubrics...',
            'Compiling official executive report...',
          ]}
        />
      </div>
    );
  }

  if (loading && !question) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <LoadingState
          title="Connecting AI Interview Studio"
          messages={[
            'Loading verified candidate credentials...',
            'Calibrating question hierarchy...',
            'Initializing real-time voice pipeline...',
            'AI interviewer ready...',
          ]}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[88vh] flex flex-col justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6">
      
      {/* ── INTERVIEW HEADER BAR ── */}
      <div className="glass-panel rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 border border-[var(--border)] shadow-md">
        
        {/* Left: Brand Identity & Candidate */}
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-200 dark:border-white/10 shrink-0">
            <Image
              src="/ashvance_logo.png"
              alt="ASHVANCE TECH"
              width={90}
              height={26}
              className="object-contain h-6 w-auto"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-tight text-[var(--text-primary)]">
              Smart Interview AI
            </span>
            <span className="text-[11px] text-[var(--text-secondary)] font-medium">
              Candidate: <strong className="text-[var(--text-primary)]">{candidateName}</strong>
            </span>
          </div>
        </div>

        {/* Center: Stage Badge & Question Progress */}
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-3 py-1 rounded-full border bg-[var(--surface-hover)] border-[var(--border)] ${stageMeta.color}`}>
            {stageMeta.icon} {stageMeta.label}
          </span>
          <span className="font-mono text-xs font-bold text-[var(--text-secondary)]">
            Question {questionNum} / {totalQuestions}
          </span>
        </div>

        {/* Right: End Interview Action */}
        <button
          onClick={() => setShowFinishConfirm(true)}
          className="px-3.5 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-500 text-xs font-bold transition-all flex items-center gap-1.5"
        >
          <span>🏁 Finish Interview</span>
        </button>
      </div>

      {/* ── PROGRESS TIMELINE BAR ── */}
      <div className="w-full">
        <div className="flex justify-between text-[11px] font-mono text-[var(--text-muted)] mb-1">
          <span>INTERVIEW PROGRESS</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="w-full bg-[var(--surface-secondary)] rounded-full h-1.5 overflow-hidden border border-[var(--border)]">
          <div
            className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-400"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ── MAIN INTERACTIVE STUDIO (2-COLUMN) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1">
        
        {/* Left: AI Orb & Current Question Card */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-6">
          
          {cheatWarning && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 text-amber-500 text-xs font-medium animate-fade-in">
              {cheatWarning}
            </div>
          )}

          {error && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-blue-400 text-xs">
              <span>{error}</span>
              <button onClick={() => setError('')} className="font-bold">✕</button>
            </div>
          )}

          {/* AI Interviewer Avatar / Central Orb */}
          <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden">
            
            <div className="relative flex items-center justify-center py-2">
              {/* Outer Pulsing Glow */}
              <div
                className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center border-2 ${orbConfig.ring} shadow-2xl transition-all duration-500 bg-gradient-to-br ${orbConfig.bg}`}
              >
                {/* Visualizer bars inside Orb */}
                <div className="flex items-center gap-1.5 h-12">
                  {[...Array(7)].map((_, i) => {
                    const height =
                      aiState === 'listening'
                        ? `${22 + Math.abs(Math.sin((orbWave + i * 45) * (Math.PI / 180))) * 28}px`
                        : aiState === 'speaking'
                        ? `${18 + Math.abs(Math.sin((orbWave + i * 35) * (Math.PI / 180))) * 30}px`
                        : aiState === 'thinking' || aiState === 'processing'
                        ? `${14 + Math.abs(Math.sin((orbWave * 2 + i * 60) * (Math.PI / 180))) * 18}px`
                        : '8px';

                    return (
                      <div
                        key={i}
                        className="rounded-full w-1.5 transition-all duration-75 bg-[var(--accent-cyan)]"
                        style={{ height, opacity: aiState === 'idle' ? 0.35 : 0.9 }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* AI State Label */}
            <span className={`text-xs tracking-wider uppercase ${orbConfig.labelColor}`}>
              {orbConfig.label}
            </span>
          </div>

          {/* Question Text Box */}
          {question && (
            <div className="glass-card p-6 sm:p-8 space-y-3 flex-1 flex flex-col justify-center border border-[var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--secondary)] uppercase">
                  QUESTION {questionNum}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full border bg-[var(--surface-hover)] border-[var(--border)] ${stageMeta.color}`}>
                  {stageMeta.label}
                </span>
              </div>

              <p className="text-lg sm:text-xl font-medium leading-relaxed text-[var(--text-primary)]">
                {question.question}
              </p>

              {/* Replay speech */}
              <div className="pt-2">
                <button
                  onClick={() => speak(question.question)}
                  disabled={aiState === 'speaking'}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors inline-flex items-center gap-1.5 font-medium disabled:opacity-40"
                >
                  <span>🔁 Replay question voice</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Response Studio, Live Transcript & Controls */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          
          {/* Response Container */}
          <div className="glass-card p-6 flex flex-col gap-4 flex-1 border border-[var(--border)]">
            
            {/* Top: Listening Status & 60s Countdown Timer */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {aiState === 'listening' ? '🎙️ Live Voice Recording...' : '🎙️ Candidate Response'}
                </span>
              </div>

              {timerActive && (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 bg-cyan-400"
                      style={{ width: `${timerPct}%` }}
                    />
                  </div>
                  <span className={`font-mono text-xs font-bold ${timerColor}`}>
                    {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:
                    {String(timeLeft % 60).padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>

            {/* Live Transcript / Input Panel */}
            {isVoiceMode ? (
              <div className="flex-1 min-h-[140px] p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm leading-relaxed text-[var(--text-primary)] flex flex-col justify-between">
                {liveTranscript || answer ? (
                  <p className="whitespace-pre-wrap">{liveTranscript || answer}</p>
                ) : (
                  <p className="text-[var(--text-muted)] italic text-xs">
                    {aiState === 'speaking'
                      ? 'AI is speaking question. Listening will start automatically...'
                      : 'Speak into your microphone. Your answer will be transcribed and submitted automatically upon pause.'}
                  </p>
                )}

                {isListening && (
                  <div className="pt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span>⚡ Auto-submits on 2.4s natural silence</span>
                    <button
                      onClick={handleManualVoiceSubmit}
                      disabled={!answer.trim()}
                      className="text-xs font-bold text-[var(--primary)] hover:underline disabled:opacity-30"
                    >
                      Submit Now ➔
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-3">
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your structured technical response here..."
                  rows={8}
                  className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] text-sm p-4 resize-none focus:outline-none focus:border-[var(--border-focus)] leading-relaxed flex-1"
                  disabled={isProcessingRef.current}
                />
                <button
                  onClick={handleTextSubmit}
                  disabled={!answer.trim() || isProcessingRef.current}
                  className="btn-primary w-full py-3 text-xs font-bold shadow-md"
                >
                  {isProcessingRef.current ? 'Evaluating Answer...' : 'Submit Answer ➔'}
                </button>
              </div>
            )}

            {/* Stage Progress Checklist */}
            <div className="pt-3 border-t border-[var(--border)] space-y-1.5">
              <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--text-muted)] uppercase block">
                STAGE TIMELINE
              </span>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                {STAGE_ORDER.map((s) => {
                  const meta = STAGE_META[s];
                  const done = completedStages.includes(s);
                  const active = s === currentStage;

                  return (
                    <div
                      key={s}
                      className={`flex items-center gap-1.5 truncate ${
                        done
                          ? 'text-emerald-500 font-semibold'
                          : active
                          ? 'text-[var(--text-primary)] font-bold'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      <span>{done ? '✓' : active ? '●' : '○'}</span>
                      <span className="truncate">{meta.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Secondary Controls Bar */}
          <div className="glass-panel rounded-2xl p-3 flex items-center justify-between gap-2 border border-[var(--border)]">
            {/* Mute AI Audio */}
            <button
              onClick={() => {
                setIsMuted((m) => !m);
                if (!isMuted) stopSpeaking();
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                isMuted
                  ? 'bg-red-500/15 border-red-500/30 text-red-500'
                  : 'bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text-secondary)]'
              }`}
              title={isMuted ? 'Unmute AI voice' : 'Mute AI voice'}
            >
              {isMuted ? '🔇 Muted' : '🔊 Voice On'}
            </button>

            {/* Text / Voice Switch */}
            <button
              onClick={() => {
                setIsVoiceMode((v) => !v);
                stopListening();
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-secondary)]"
            >
              {isVoiceMode ? '⌨️ Text Mode' : '🎙️ Voice Mode'}
            </button>

            {/* Clarification Button */}
            <button
              onClick={() => {
                setShowClarifyModal(true);
                setClarifyResponse('');
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--secondary)]"
            >
              💬 Clarify
            </button>
          </div>

        </div>

      </div>

      {/* ── CLARIFICATION MODAL ── */}
      {showClarifyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full p-6 space-y-4 border border-[var(--border)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Ask AI Interviewer for Clarification
              </h3>
              <button onClick={() => setShowClarifyModal(false)} className="text-[var(--text-muted)] text-sm">✕</button>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Ask a question about scope, requirements, or architecture assumptions without affecting your evaluation score.
            </p>

            <form onSubmit={handleAskClarification} className="space-y-3">
              <input
                type="text"
                value={clarifyQuery}
                onChange={(e) => setClarifyQuery(e.target.value)}
                placeholder="e.g. Can you clarify what you mean by optimization?"
                className="input-field text-sm"
                autoFocus
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClarifyModal(false)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!clarifyQuery.trim() || isClarifying}
                  className="btn-primary text-xs px-4 py-2"
                >
                  {isClarifying ? 'Asking AI...' : 'Ask Clarification ➔'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FINISH CONFIRMATION MODAL ── */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 space-y-4 border border-[var(--border)] text-center">
            <span className="text-4xl block">🏁</span>
            <h3 className="text-lg font-black text-[var(--text-primary)]">
              Conclude AI Technical Interview?
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Your answered questions will be synthesized into the official ASHVANCE TECH Scorecard and Executive PDF report.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="btn-secondary text-xs px-5 py-2.5"
              >
                Continue Interview
              </button>
              <button
                onClick={handleConfirmFinish}
                className="btn-primary text-xs px-5 py-2.5"
              >
                Conclude &amp; Generate Scorecard
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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--secondary)] border-t-transparent animate-spin" />
        </div>
      }
    >
      <InterviewContent />
    </Suspense>
  );
}
