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

const TYPE_LABELS: Record<string, { label: string; color: string; badgeBg: string }> = {
  technical: { label: 'Technical Depth', color: 'text-cyan-300', badgeBg: 'bg-cyan-500/15 border-cyan-500/30' },
  project: { label: 'Project Architecture', color: 'text-purple-300', badgeBg: 'bg-purple-500/15 border-purple-500/30' },
  behavioral: { label: 'Situational & Soft Skills', color: 'text-amber-300', badgeBg: 'bg-amber-500/15 border-amber-500/30' },
  logical: { label: 'Problem Solving', color: 'text-emerald-300', badgeBg: 'bg-emerald-500/15 border-emerald-500/30' },
  general: { label: 'Introduction & Background', color: 'text-indigo-300', badgeBg: 'bg-indigo-500/15 border-indigo-500/30' },
};

const TIMER_SECONDS = 90;

function InterviewContent() {
  const router = useRouter();
  const params = useSearchParams();
  const candidateId = Number(params.get('candidateId'));
  const candidateName = decodeURIComponent(params.get('name') || 'Candidate');
  const totalQuestions = Number(params.get('total') || 12);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [timerActive, setTimerActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  
  // Voice & Audio States
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(false); // Only speaks when clicked or if auto-speak is enabled
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [micError, setMicError] = useState('');
  const [cheatWarning, setCheatWarning] = useState('');
  const [autoAdvanceCount, setAutoAdvanceCount] = useState<number | null>(null);

  // Two-Way Interactive Dialogue (Ask AI) States
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [clarifyQuery, setClarifyQuery] = useState('');
  const [clarifyResponse, setClarifyResponse] = useState('');
  const [isClarifying, setIsClarifying] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Sweet Female Text-To-Speech (TTS) Engine
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      
      // Select the sweetest female voice available on the platform
      if (voices.length > 0) {
        const sweetFemaleVoice = voices.find(v => 
          (v.name.includes('Zira') || v.name.includes('Google US English') || v.name.includes('Samantha') || 
           v.name.includes('Victoria') || v.name.includes('Karen') || v.name.includes('Natural') || 
           v.name.includes('Female') || v.name.includes('Jenny') || v.name.includes('Aria')) &&
          (v.lang.startsWith('en'))
        ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

        utterance.voice = sweetFemaleVoice;
      }

      // Warm, sweet, natural conversational cadence
      utterance.pitch = 1.15; // Slightly higher pitch for a sweet female tone
      utterance.rate = 0.93;  // Calm, articulate pacing

      (window as any).currentUtterance = utterance;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    }, 80);
  }, []);

  // Real-time Fast Speech Recognition + MediaRecorder
  const handleStartRecording = async () => {
    setMicError('');
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
      setAudioBlob(null);

      // Instant 0ms Live Speech-to-Text Transcription via Web Speech API
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript + ' ';
          }
          setAnswer(transcript.trim());
        };

        recognition.onerror = (err: any) => {
          console.warn('Speech recognition warning:', err);
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

    } catch (err) {
      console.error('Mic error:', err);
      setMicError('Could not access microphone. Please check permissions.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  const handleSubmitVoice = async () => {
    // If text was captured via live speech recognition, submit immediately
    if (answer.trim()) {
      await processSubmission(answer.trim());
      return;
    }

    if (!audioBlob) return;

    setIsTranscribing(true);
    setError('');
    try {
      const { text } = await transcribeAudio(audioBlob);
      setAnswer(text);
      await processSubmission(text);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Transcription failed. You can type your answer below.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Fetch Questions
  const fetchQ = useCallback(async (retryCount = 0) => {
    if (!candidateId) { router.push('/'); return; }
    setLoading(true);
    setError('');
    try {
      const qs = await getQuestions(candidateId);
      if (qs && qs.length > 0) {
        setQuestions(qs);
      }
    } catch (e: any) {
      console.error(`Fetch question failed:`, e);
      if (retryCount < 1) {
        setTimeout(() => fetchQ(retryCount + 1), 1500);
      } else {
        const detail = e?.response?.data?.detail;
        const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
        setError(msg || 'AI service interruption. Please check your backend logs.');
      }
    } finally {
      setLoading(false);
    }
  }, [candidateId, router]);

  useEffect(() => {
    fetchQ();
  }, [fetchQ]);

  // Auto-speak question only if user enabled auto-speak
  useEffect(() => {
    if (questions[currentIdx] && !showFeedback && !loading && autoSpeakEnabled && isVoiceMode) {
      speak(questions[currentIdx].question);
    }
  }, [currentIdx, loading, questions, showFeedback, autoSpeakEnabled, isVoiceMode, speak]);

  // Question Timer
  useEffect(() => {
    if (!timerActive || showFeedback || isVoiceMode) return;
    setTimeLeft(TIMER_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [currentIdx, showFeedback, isVoiceMode]);

  // Anti-Cheat: Tab Switch Detection
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden && !showFeedback && !evaluation?.interview_complete && !generatingReport) {
        setCheatWarning('⚠️ Warning: Tab switching is monitored and logged in the recruiter evaluation.');
        try {
          await recordWarning(candidateId, 'tab_switch');
        } catch (e) {
          console.error('Failed to record warning', e);
        }
        setTimeout(() => setCheatWarning(''), 5000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [candidateId, showFeedback, evaluation, generatingReport]);

  const handleCopyPaste = async () => {
    setCheatWarning('⚠️ Notice: Copy/paste events are recorded for proctoring compliance.');
    try {
      await recordWarning(candidateId, 'copy_paste');
    } catch (err) {
      console.error('Failed to record copy paste warning', err);
    }
    setTimeout(() => setCheatWarning(''), 5000);
  };

  const handleAutoSubmit = useCallback(async () => {
    setTimerActive(false);
    await handleSubmit(true);
  }, [answer, currentIdx, questions, candidateId]);

  const handleSubmit = async (isAuto = false) => {
    if (isSubmitting || questions.length === 0) return;
    await processSubmission(isAuto && !answer.trim() ? '[No answer provided — time expired]' : answer);
  };

  const processSubmission = async (submittedAnswer: string) => {
    if (!submittedAnswer.trim()) {
      setError('Please provide an answer before submitting.');
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);
    setIsSubmitting(true);
    setError('');
    const currentQ = questions[currentIdx];

    try {
      const result = await submitAnswer(candidateId, currentQ.question_order, submittedAnswer);
      setEvaluation(result);
      setShowFeedback(true);

      // Speak feedback gracefully in sweet female voice if voice mode is on
      if (isVoiceMode && autoSpeakEnabled) {
        speak("Thank you for your answer! I have analyzed your response. Let us move to the next question.");
      }

      // Append next question seamlessly into state
      if (result.next_question && !result.interview_complete) {
        setQuestions(prev => {
          const newQs = [...prev];
          newQs[currentIdx + 1] = result.next_question!;
          return newQs;
        });
      }
    } catch (e: any) {
      console.error('Submission failed:', e);
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
      setError(msg || 'Evaluating your answer failed. Your response is safely saved, please retry.');
    } finally {
      setIsSubmitting(false);
      if (!error) setAudioBlob(null);
    }
  };

  // Fixed handleNext: Seamlessly moves to next question without stopping or requiring refresh
  const handleNext = async () => {
    if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    setAutoAdvanceCount(null);

    if (evaluation?.interview_complete) {
      setGeneratingReport(true);
      await new Promise(res => setTimeout(res, 1000));
      router.push(`/report?candidateId=${candidateId}&name=${encodeURIComponent(candidateName)}`);
      return;
    }

    setShowFeedback(false);
    setEvaluation(null);
    setAnswer('');
    setAudioBlob(null);
    
    const nextIdx = currentIdx + 1;
    setCurrentIdx(nextIdx);
    setTimerActive(true);

    // If next question is not yet in array, fetch it dynamically from backend
    if (!questions[nextIdx]) {
      try {
        const freshQs = await getQuestions(candidateId);
        if (freshQs && freshQs.length > 0) {
          setQuestions(freshQs);
          // Set index to the first unanswered question
          const activeIndex = freshQs.findIndex(q => !q.question_order || q.question_order === nextIdx + 1);
          if (activeIndex !== -1) setCurrentIdx(activeIndex);
        }
      } catch (err) {
        console.error('Failed to load next question:', err);
      }
    }
  };

  // Auto-advance countdown
  useEffect(() => {
    if (!showFeedback || !evaluation || evaluation.interview_complete) return;
    setAutoAdvanceCount(4);
    autoAdvanceRef.current = setInterval(() => {
      setAutoAdvanceCount(prev => {
        if (prev === null || prev <= 1) {
          if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
          handleNext();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    };
  }, [showFeedback, evaluation]);

  // Two-Way Interactive Dialogue: Ask AI / Clarification
  const handleAskClarification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarifyQuery.trim() || isClarifying) return;
    setIsClarifying(true);
    setClarifyResponse('');

    try {
      const currentQ = questions[currentIdx]?.question || 'General technical interview question';
      const res = await clarifyQuestion(candidateId, currentQ, clarifyQuery.trim());
      setClarifyResponse(res.ai_response);
      
      // Speak the clarification answer in sweet female voice
      speak(res.ai_response);
    } catch (err: any) {
      setClarifyResponse('Feel free to assume standard industry best practices and continue with your approach.');
    } finally {
      setIsClarifying(false);
    }
  };

  // Explicit End & Finish Interview
  const handleConfirmFinish = async () => {
    setShowFinishConfirm(false);
    setGeneratingReport(true);
    try {
      await finishInterview(candidateId);
    } catch (e) {
      console.warn('Finish interview call completed with fallback:', e);
    }
    await new Promise(res => setTimeout(res, 1200));
    router.push(`/report?candidateId=${candidateId}&name=${encodeURIComponent(candidateName)}`);
  };

  const timerColor = timeLeft > 30 ? 'text-emerald-400' : timeLeft > 10 ? 'text-amber-400' : 'text-red-400';
  const progressPercent = questions.length > 0 ? Math.min(100, Math.round(((currentIdx + 1) / Math.max(totalQuestions, 10)) * 100)) : 10;

  if (generatingReport) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <LoadingState
          title="Synthesizing Your Comprehensive Scorecard"
          messages={[
            "Evaluating technical depth and code architecture...",
            "Analyzing communication clarity and problem-solving...",
            "Compiling recruiter recommendations and improvement areas...",
            "Finalizing your downloadable PDF scorecard..."
          ]}
        />
      </div>
    );
  }

  if (loading && !questions.length) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <LoadingState
          title="Initializing AI Interview Studio"
          messages={[
            "Loading verified candidate profile...",
            "Synthesizing customized question matrix...",
            "Calibrating sweet female voice engine...",
            "Opening interview room..."
          ]}
        />
      </div>
    );
  }

  if (error && !questions.length) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div className="glass-card max-w-md w-full p-8">
          <div className="w-16 h-16 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Session Interrupted</h2>
          <p className="text-red-300/80 text-sm mb-6 leading-relaxed">{error}</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => fetchQ()} className="btn-primary w-full py-3.5">
              🔄 Retry Loading
            </button>
            <button onClick={() => router.push('/')} className="text-white/50 hover:text-white/80 text-xs font-semibold">
              ← Return to Registration
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Graceful fallback if index is loading
  const currentQ = questions[currentIdx] || {
    question_order: currentIdx + 1,
    question_type: 'technical',
    stage: 'technical',
    question: 'Please walk me through your engineering design approach for scalable systems.'
  };

  const typeInfo = TYPE_LABELS[currentQ.question_type] || TYPE_LABELS.general;

  return (
    <div className="min-h-screen flex flex-col px-4 sm:px-6 lg:px-8 py-6 relative">
      
      {/* Top Floating Action Bar: Finish & Submit */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <button
          onClick={() => setShowFinishConfirm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold transition-all shadow-lg backdrop-blur-md hover:scale-105"
          title="Finish and submit interview now"
        >
          <span>🏁 Finish & Submit Interview</span>
        </button>
      </div>

      {/* Top Header Panel */}
      <div className="max-w-4xl w-full mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 glass-panel px-6 py-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500/30 to-purple-500/30 border border-primary-400/40 flex items-center justify-center text-xl">
            👩‍💼
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">AI Interview Practice Studio</h1>
            <p className="text-white/50 text-xs">{getGreeting()}, <span className="text-primary-300 font-semibold">{candidateName}</span></p>
          </div>
        </div>

        {/* Controls & Voice Mode Options */}
        <div className="flex items-center gap-2.5">
          {/* Voice Mode Toggle */}
          <button
            onClick={() => {
              const next = !isVoiceMode;
              setIsVoiceMode(next);
              setAnswer('');
              setAudioBlob(null);
              setTimerActive(!next);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              isVoiceMode
                ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40 shadow-lg shadow-purple-500/20'
                : 'bg-white/5 text-white/50 border border-white/10 hover:text-white'
            }`}
          >
            <span>{isVoiceMode ? '🎙️ Voice Mode' : '⌨️ Text Mode'}</span>
          </button>

          {/* Auto-play Speech Toggle */}
          {isVoiceMode && (
            <button
              onClick={() => setAutoSpeakEnabled(prev => !prev)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                autoSpeakEnabled 
                  ? 'bg-primary-500/25 border-primary-400/40 text-primary-200' 
                  : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
              }`}
              title="Toggle automatic AI speech reading"
            >
              {autoSpeakEnabled ? '🔊 Auto-Speech: ON' : '🔈 Auto-Speech: OFF'}
            </button>
          )}

          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/70">
            Q {currentIdx + 1} / ~{totalQuestions}
          </div>
        </div>
      </div>

      {/* Stage Progress Bar */}
      <div className="max-w-4xl w-full mx-auto mb-6 space-y-2">
        <div className="flex justify-between items-center text-xs text-white/50 font-medium">
          <span className="capitalize text-primary-300 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
            Stage: {currentQ.stage || 'General'}
          </span>
          <span className="font-mono">{progressPercent}% Progress</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden p-0.5 border border-white/10">
          <div
            className="bg-gradient-to-r from-primary-500 via-purple-500 to-cyan-400 h-full rounded-full progress-bar shadow-lg shadow-primary-500/50"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col gap-6">
        
        {/* Anti-Cheat Warning */}
        {cheatWarning && (
          <div className="bg-red-500/15 border border-red-500/30 rounded-2xl px-5 py-3.5 flex items-center gap-3 text-red-300 text-sm animate-shake">
            <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="font-semibold">{cheatWarning}</p>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/15 border border-red-500/30 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-3 text-red-300 text-sm animate-shake">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>{error}</p>
            </div>
            <button
              onClick={() => isVoiceMode ? handleSubmitVoice() : handleSubmit(false)}
              className="px-3.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-bold rounded-xl border border-red-500/40 transition-all shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Question Card */}
        <div className="glass-card p-6 sm:p-8 border border-white/15 shadow-2xl relative overflow-hidden">
          
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between mb-5 gap-3">
            <span className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold border ${typeInfo.badgeBg} ${typeInfo.color}`}>
              {typeInfo.label}
            </span>

            <div className="flex items-center gap-2.5">
              {/* Speaking Wave Visualizer */}
              {isSpeaking && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold">
                  <div className="flex items-end gap-0.5 h-3">
                    <span className="w-1 bg-purple-400 rounded-full wave-bar-1" />
                    <span className="w-1 bg-purple-400 rounded-full wave-bar-3" />
                    <span className="w-1 bg-purple-400 rounded-full wave-bar-5" />
                    <span className="w-1 bg-purple-400 rounded-full wave-bar-2" />
                  </div>
                  <span>AI Speaking (Female Voice)...</span>
                </div>
              )}

              {/* Sweet Female Voice Play Button */}
              {!showFeedback && (
                <button
                  onClick={() => speak(currentQ.question)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 hover:text-white transition-all text-xs font-bold border border-purple-500/30 shadow-md"
                  title="Play question in sweet female voice"
                >
                  <span>🔊 Play Voice</span>
                </button>
              )}

              {/* Two-Way Person to Person Clarify Button */}
              {!showFeedback && (
                <button
                  onClick={() => {
                    setShowClarifyModal(true);
                    setClarifyResponse('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 hover:text-white transition-all text-xs font-bold border border-cyan-500/30"
                  title="Ask interviewer a clarifying question"
                >
                  <span>💬 Ask AI Clarification</span>
                </button>
              )}

              {!showFeedback && !isVoiceMode && (
                <div className={`flex items-center gap-1.5 font-mono text-lg font-bold px-3 py-1 rounded-xl bg-white/5 border border-white/10 ${timerColor}`}>
                  ⏱️ {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                </div>
              )}
            </div>
          </div>

          {/* Question Text */}
          <p className="text-white text-xl sm:text-2xl font-semibold leading-relaxed select-none" onCopy={handleCopyPaste}>
            {currentQ.question}
          </p>
        </div>

        {/* Main Response Area */}
        {!showFeedback ? (
          <div className="glass-card p-6 sm:p-10 border border-white/15 flex flex-col items-center justify-center min-h-[340px]">
            {isVoiceMode ? (
              <div className="w-full flex flex-col items-center gap-6 text-center">
                
                {/* Visualizer Recording Orb */}
                <div className="relative">
                  {isListening && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-red-500/25 animate-ping" style={{ animationDuration: '1.5s' }} />
                      <div className="absolute -inset-4 rounded-full bg-red-500/15 animate-pulse" />
                    </>
                  )}

                  <div className={`w-28 h-28 rounded-3xl flex items-center justify-center transition-all duration-300 relative z-10 ${
                    isListening 
                      ? 'bg-red-500 text-white shadow-[0_0_50px_rgba(239,68,68,0.5)] scale-105' 
                      : isTranscribing || isSubmitting 
                        ? 'bg-purple-500/20 text-purple-300 border-2 border-purple-400 animate-pulse' 
                        : answer.trim() || audioBlob 
                          ? 'bg-emerald-500/20 text-emerald-300 border-2 border-emerald-400/50' 
                          : 'bg-white/5 border-2 border-white/10 text-white/50 hover:border-primary-400/60'
                  }`}>
                    {isTranscribing || isSubmitting ? (
                      <svg className="w-12 h-12 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {isListening ? (
                          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                        ) : answer.trim() || audioBlob ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        )}
                      </svg>
                    )}
                  </div>
                </div>

                {/* Subtitle Status */}
                <div className="space-y-1">
                  <p className="text-white font-bold text-lg">
                    {isListening ? '🎙️ Listening & Transcribing in Real-Time...' : answer.trim() ? '✅ Speech Transcribed Live' : 'Ready to record your answer'}
                  </p>
                  <p className="text-white/40 text-xs">
                    {isListening ? 'Speak naturally. Your words appear live below.' : 'Click "Start Recording" when ready'}
                  </p>
                </div>

                {/* Real-Time Live Transcript Preview Box */}
                {answer.trim() && (
                  <div className="w-full max-w-xl text-left bg-white/5 border border-white/15 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs text-white/50 font-mono">
                      <span>Live Speech Transcript:</span>
                      <span className="text-emerald-300 font-bold">● Live Edit Enabled</span>
                    </div>
                    <textarea
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      rows={3}
                      className="w-full bg-transparent text-white text-sm border-0 focus:ring-0 focus:outline-none resize-none leading-relaxed"
                      placeholder="Your transcribed text will appear here..."
                    />
                  </div>
                )}

                {/* Voice Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                  {!isListening && !answer.trim() && !audioBlob && (
                    <button
                      onClick={handleStartRecording}
                      disabled={isSpeaking || isTranscribing || isSubmitting}
                      className="btn-primary flex-1 py-4 text-base font-bold shadow-xl shadow-primary-500/25"
                    >
                      <span>🎙️ Start Recording</span>
                    </button>
                  )}

                  {isListening && (
                    <button
                      onClick={handleStopRecording}
                      className="bg-red-500 hover:bg-red-600 active:scale-95 text-white font-bold py-4 px-8 rounded-xl flex-1 transition-all shadow-xl shadow-red-500/30 flex items-center justify-center gap-2"
                    >
                      <div className="w-3.5 h-3.5 bg-white rounded-sm" />
                      <span>Stop & Review</span>
                    </button>
                  )}

                  {(answer.trim() || audioBlob) && !isListening && (
                    <>
                      <button
                        onClick={handleStartRecording}
                        disabled={isTranscribing || isSubmitting}
                        className="btn-secondary flex-1 py-4 text-sm font-bold"
                      >
                        🔄 Retake
                      </button>
                      <button
                        onClick={handleSubmitVoice}
                        disabled={isTranscribing || isSubmitting}
                        className="btn-primary flex-[2] py-4 text-base font-bold"
                      >
                        {isTranscribing ? 'Transcribing...' : isSubmitting ? 'Evaluating...' : 'Submit Answer ➔'}
                      </button>
                    </>
                  )}
                </div>

                {micError && <p className="text-red-400 text-xs font-semibold">{micError}</p>}
              </div>
            ) : (
              <div className="w-full flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white/80">Type Your Answer</label>
                  <span className="text-xs text-white/40 font-mono">{answer.length} chars</span>
                </div>

                <textarea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onPaste={handleCopyPaste}
                  onCopy={handleCopyPaste}
                  placeholder="Provide a detailed, structured technical response..."
                  rows={8}
                  className="input-field resize-none text-base leading-relaxed p-5"
                  disabled={isSubmitting}
                />

                <button
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting || !answer.trim()}
                  className="btn-primary self-end px-10 py-3.5 text-base font-bold shadow-xl shadow-primary-500/20"
                >
                  {isSubmitting ? 'Evaluating with AI...' : 'Submit Answer ➔'}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Response Evaluation Feedback Card */
          <div className="glass-card p-6 sm:p-8 border border-white/15 space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  ✓
                </div>
                <h3 className="text-white font-bold text-lg">AI Response Evaluation</h3>
              </div>
              <span className="text-xs font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                Graded Instantly
              </span>
            </div>

            {/* Score Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Technical Depth', value: evaluation?.technical_score, color: 'text-cyan-300' },
                { label: 'Clarity', value: evaluation?.clarity_score, color: 'text-purple-300' },
                { label: 'Architecture', value: evaluation?.depth_score, color: 'text-indigo-300' },
                { label: 'Communication', value: evaluation?.communication_score, color: 'text-emerald-300' },
              ].map(s => (
                <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                  <p className="text-white/40 text-xs mb-1 font-medium">{s.label}</p>
                  <p className={`text-2xl font-extrabold font-mono ${s.color}`}>
                    {s.value?.toFixed(1)}<span className="text-white/30 text-xs font-normal">/10</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Detailed AI Feedback Box */}
            <div className="bg-primary-950/40 border border-primary-500/20 rounded-2xl p-5">
              <p className="text-primary-200 text-sm leading-relaxed italic">
                "{evaluation?.feedback}"
              </p>
            </div>

            {/* Next Step / Complete Action */}
            {evaluation?.interview_complete ? (
              <button onClick={handleNext} className="btn-primary w-full py-4 font-extrabold text-lg shadow-2xl shadow-primary-500/30">
                🏆 View Final Scorecard & Improvement Plan
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={handleNext} className="btn-primary flex-1 py-4 font-bold text-base shadow-xl shadow-primary-500/25">
                  <span>Proceed to Next Question</span>
                  <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
                {autoAdvanceCount !== null && (
                  <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10 shrink-0 font-mono">
                    <span className="text-xl font-black text-primary-300">{autoAdvanceCount}s</span>
                    <span className="text-[8px] text-white/30 uppercase">auto</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two-Way Clarification Dialog Modal */}
      {showClarifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card max-w-lg w-full p-6 sm:p-8 border border-cyan-500/30 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💬</span>
                <h3 className="text-lg font-bold text-white">Ask Clarifying Question</h3>
              </div>
              <button
                onClick={() => setShowClarifyModal(false)}
                className="text-white/40 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-white/60 text-xs leading-relaxed">
              Have a doubt or want to discuss assumptions about the current question? Ask the AI interviewer directly.
            </p>

            <form onSubmit={handleAskClarification} className="space-y-4">
              <textarea
                value={clarifyQuery}
                onChange={e => setClarifyQuery(e.target.value)}
                placeholder="e.g., Can I assume this architecture uses a relational database, or should I design for NoSQL?"
                rows={3}
                className="input-field text-sm"
                disabled={isClarifying}
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClarifyModal(false)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClarifying || !clarifyQuery.trim()}
                  className="btn-primary text-xs py-2 px-5 font-bold"
                >
                  {isClarifying ? 'AI Thinking...' : 'Ask AI ➔'}
                </button>
              </div>
            </form>

            {/* AI Voice Response to Candidate */}
            {clarifyResponse && (
              <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-2xl p-4 space-y-2 animate-slide-up">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300">AI Interviewer Response:</span>
                  <button
                    onClick={() => speak(clarifyResponse)}
                    className="text-xs text-cyan-300 hover:text-white flex items-center gap-1"
                  >
                    🔊 Play Response
                  </button>
                </div>
                <p className="text-cyan-100 text-sm leading-relaxed">{clarifyResponse}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Finish & Submit Confirmation Modal */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card max-w-md w-full p-6 sm:p-8 border border-emerald-500/30 space-y-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-3xl">
              🏁
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Finish & Submit Interview?</h3>
              <p className="text-white/60 text-xs leading-relaxed">
                Your completed answers will be finalized, your official scorecard generated, and your detailed interview feedback will be emailed to you.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="btn-secondary flex-1 py-3 text-xs font-bold"
              >
                Keep Practicing
              </button>
              <button
                onClick={handleConfirmFinish}
                className="btn-primary flex-1 py-3 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
              >
                Yes, Submit Now
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
          <span className="w-3 h-3 rounded-full bg-primary-400 animate-bounce" />
          <span className="w-3 h-3 rounded-full bg-primary-400 animate-bounce [animation-delay:0.2s]" />
          <span className="w-3 h-3 rounded-full bg-primary-400 animate-bounce [animation-delay:0.4s]" />
        </div>
      </div>
    }>
      <InterviewContent />
    </Suspense>
  );
}
