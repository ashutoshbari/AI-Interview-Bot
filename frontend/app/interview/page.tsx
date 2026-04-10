'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getQuestions, submitAnswer, transcribeAudio, Question, EvaluationResponse } from '@/lib/api';
import LoadingState from '@/components/LoadingState';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  technical: { label: 'Technical', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  project: { label: 'Project Deep-Dive', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  behavioral: { label: 'Behavioral', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  logical: { label: 'Logical', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  general: { label: 'General', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
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
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [micError, setMicError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // TTS Function
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!window.speechSynthesis) return;

    // Clear previous queue
    window.speechSynthesis.cancel();

    // Browser bug workaround: setTimeout ensures the cancel operation completes
    // before queueing the next utterance. Otherwise it silently fails.
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);

      // Fix Chrome garbage collection bug by keeping a reference
      (window as any).currentUtterance = utterance;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };
      utterance.onerror = (e) => {
        console.error('SpeechSynthesis Error:', e);
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    }, 50);
  }, []);

  // 1. Start Recording
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
      setAnswer('');
    } catch (err) {
      console.error('Mic error:', err);
      setMicError('Could not access microphone. Please check permissions.');
    }
  };

  // 2. Stop Recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  // 3. Submit Voice Answer
  const handleSubmitVoice = async () => {
    if (!audioBlob) return;

    setIsTranscribing(true);
    setError('');
    try {
      const { text } = await transcribeAudio(audioBlob);
      setAnswer(text);
      await processSubmission(text);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Trigger speak on question change (NO AUTO START RECORDING)
  useEffect(() => {
    if (isVoiceMode && questions[currentIdx] && !showFeedback && !loading) {
      speak(questions[currentIdx].question);
    }
  }, [currentIdx, loading, isVoiceMode, questions.length, showFeedback, speak]);

  // Extract fetch logic to allow retries
  const fetchQ = useCallback(async (retryCount = 0) => {
    if (!candidateId) { router.push('/'); return; }
    setLoading(true);
    setError('');
    try {
      const qs = await getQuestions(candidateId);
      setQuestions(qs);
    } catch (e: any) {
      console.error(`Fetch initial question failed (Attempt ${retryCount + 1}):`, e);
      if (retryCount < 1) {
        // Auto-retry once after 1.5s
        setTimeout(() => fetchQ(retryCount + 1), 1500);
      } else {
        const detail = e?.response?.data?.detail;
        const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
        setError(msg || 'AI service interruption. Please check your backend logs.');
      }
    } finally {
      if (retryCount >= 1 || questions.length > 0) setLoading(false);
    }
  }, [candidateId, router, questions.length]);

  // Fetch initial question
  useEffect(() => {
    fetchQ();
  }, [fetchQ]);

  // Question timer (Text Mode only)
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
      setError('Please provide an answer.');
      return;
    }
    clearInterval(timerRef.current!);
    setTimerActive(false);
    setIsSubmitting(true);
    setError('');
    const currentQ = questions[currentIdx];

    try {
      const result = await submitAnswer(candidateId, currentQ.question_order, submittedAnswer);
      setEvaluation(result);
      setShowFeedback(true);

      if (isVoiceMode) {
        speak("Thank you for your answer.");
      }

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
      setError(msg || 'Submitting your answer failed. Your response is saved, please retry.');
    } finally {
      setIsSubmitting(false);
      // Note: We deliberately don't clear audioBlob here on failure 
      // so they can try to transcribe/submit again.
      if (!error) setAudioBlob(null);
    }
  };

  const handleNext = async () => {
    if (!evaluation) return;
    if (evaluation.interview_complete) {
      setGeneratingReport(true);
      await new Promise(res => setTimeout(res, 2000));
      router.push(`/report?candidateId=${candidateId}&name=${encodeURIComponent(candidateName)}`);
      return;
    }
    setShowFeedback(false);
    setEvaluation(null);
    setAnswer('');
    setAudioBlob(null);
    setCurrentIdx(prev => prev + 1);
    setTimerActive(true);
  };

  const timerPercent = (timeLeft / TIMER_SECONDS) * 100;
  const timerColor = timeLeft > 30 ? 'text-green-400' : timeLeft > 10 ? 'text-amber-400' : 'text-red-400';
  const progressPercent = questions.length > 0
    ? Math.round(((currentIdx) / questions.length) * 100)
    : 0;

  if (generatingReport) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <LoadingState
          title="Generating Final Report"
          messages={[
            "Analyzing your technical depth...",
            "Evaluating communication skills...",
            "Synthesizing hiring recommendation...",
            "Finalizing your scores..."
          ]}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <LoadingState
          title="Preparing Interview"
          messages={[
            "Analyzing your resume...",
            "Preparing personalized questions...",
            "Setting up your interview...",
            "Almost ready..."
          ]}
        />
      </div>
    );
  }

  if (error && !questions.length) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div className="card max-w-md w-full">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Interview Error</h2>
          <p className="text-red-300/80 text-sm mb-6 leading-relaxed">{error}</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => fetchQ()} className="btn-primary w-full py-3">Retry Initializing</button>
            <button onClick={() => router.push('/')} className="text-white/40 hover:text-white/60 text-sm font-medium transition-colors">Back to Registration</button>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  if (!currentQ) return null;
  const typeInfo = TYPE_LABELS[currentQ.question_type] || TYPE_LABELS.general;

  return (
    <div className="min-h-screen flex flex-col px-4 py-8">
      {/* Header */}
      <div className="max-w-3xl w-full mx-auto mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">AI Interview</h1>
          <p className="text-white/40 text-sm">Welcome, {candidateName}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Voice Toggle */}
          <button
            onClick={() => {
              const next = !isVoiceMode;
              setIsVoiceMode(next);
              setAnswer('');
              setAudioBlob(null);
              if (next) setTimerActive(false);
              else setTimerActive(true);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isVoiceMode
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'bg-white/5 text-white/40 border border-white/10'
              }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Voice Mode {isVoiceMode ? 'ON' : 'OFF'}
          </button>

          <div className="text-right">
            <p className="text-white/40 text-xs">Interview Stage</p>
            <p className="text-white font-bold capitalize">{currentQ.stage || 'General'}</p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="max-w-3xl w-full mx-auto mb-6">
        <div className="flex justify-between text-xs text-white/40 mb-2 font-medium">
          <span>Performance Check</span>
          <span>Goal: 12-15 Questions</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-primary-500 to-purple-500 h-full progress-bar transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col gap-4">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3 animate-shake">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-300 text-sm">{error}</p>
            </div>

            {(error.includes('AI') || error.includes('timeout') || error.includes('limit')) && (
              <button
                onClick={() => isVoiceMode ? handleSubmitVoice() : handleSubmit(false)}
                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold rounded-lg border border-red-500/40 transition-all whitespace-nowrap"
              >
                Retry Action
              </button>
            )}
          </div>
        )}

        {/* Question Card */}
        <div className="card animate-slide-up relative overflow-hidden">
          <div className="flex items-start justify-between mb-4 gap-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${typeInfo.color}`}>
              {typeInfo.label}
            </span>

            <div className="flex items-center gap-3">
              {isSpeaking && (
                <div className="flex items-center gap-2 text-purple-300 text-xs animate-pulse">
                  <div className="flex gap-0.5">
                    <div className="w-1 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  AI is speaking...
                </div>
              )}

              {!showFeedback && !isVoiceMode && (
                <div className={`flex items-center gap-1.5 font-mono text-lg font-bold ${timerColor}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                </div>
              )}
            </div>
          </div>
          <p className="text-white text-xl md:text-2xl font-medium leading-relaxed">{currentQ.question}</p>
        </div>

        {/* Main Interaction Area */}
        {!showFeedback ? (
          <div className="card animate-fade-in flex flex-col items-center justify-center gap-8 py-10 min-h-[350px]">
            {isVoiceMode ? (
              <div className="w-full flex flex-col items-center gap-8">
                <div className="relative">
                  {isListening && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-primary-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                      <div className="absolute inset-0 rounded-full bg-primary-500/10 animate-ping" style={{ animationDelay: '500ms', animationDuration: '2s' }} />
                    </>
                  )}

                  <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)]' :
                    isTranscribing || isSubmitting ? 'bg-purple-500/20 text-purple-300 animate-pulse' :
                      audioBlob ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                        'bg-white/5 text-white/40'
                    }`}>
                    {isTranscribing || isSubmitting ? (
                      <svg className="w-10 h-10 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {isListening ? (
                          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                        ) : audioBlob ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        )}
                      </svg>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                  {!isListening && !audioBlob && (
                    <button
                      onClick={handleStartRecording}
                      disabled={isSpeaking || isTranscribing || isSubmitting}
                      className="btn-primary flex-1 flex items-center justify-center gap-2 py-4 shadow-lg shadow-primary-500/20"
                    >
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                      Start Recording
                    </button>
                  )}

                  {isListening && (
                    <button
                      onClick={handleStopRecording}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-8 rounded-2xl flex-1 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                    >
                      <div className="w-3 h-3 bg-white rounded-sm" />
                      Stop Recording
                    </button>
                  )}

                  {audioBlob && !isListening && (
                    <>
                      <button
                        onClick={handleStartRecording}
                        disabled={isTranscribing || isSubmitting}
                        className="bg-white/5 hover:bg-white/10 text-white/70 font-bold py-4 px-6 rounded-2xl transition-all border border-white/10"
                      >
                        Retake
                      </button>
                      <button
                        onClick={handleSubmitVoice}
                        disabled={isTranscribing || isSubmitting}
                        className="btn-primary flex-[2] flex items-center justify-center gap-2 py-4 shadow-lg shadow-primary-500/20"
                      >
                        {isTranscribing ? 'Transcribing...' : isSubmitting ? 'Submitting...' : 'Submit Answer'}
                        {!isTranscribing && !isSubmitting && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
                      </button>
                    </>
                  )}
                </div>

                {micError && <p className="text-red-400 text-xs font-medium">{micError}</p>}

                <p className="text-white/30 text-xs uppercase tracking-widest font-bold">
                  {isListening ? 'Speak now' : audioBlob ? 'Review or Submit' : 'Click "Start" when ready'}
                </p>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-4">
                <label className="text-sm font-medium text-white/60">Your Answer</label>
                <textarea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder="Type your detailed answer here..."
                  rows={8}
                  className="input-field resize-none text-base leading-relaxed p-6"
                  disabled={isSubmitting}
                />
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting || !answer.trim()}
                  className="btn-primary self-end px-12 py-4 text-lg font-bold shadow-xl shadow-primary-500/20"
                >
                  {isSubmitting ? 'Evaluating...' : 'Submit Answer →'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="card animate-slide-up space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-white font-semibold">Answer Evaluated</h3>
            </div>

            {/* Score mini-cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Technical', value: evaluation?.technical_score },
                { label: 'Clarity', value: evaluation?.clarity_score },
                { label: 'Depth', value: evaluation?.depth_score },
                { label: 'Communication', value: evaluation?.communication_score },
              ].map(s => (
                <div key={s.label} className="glass-light rounded-xl p-3 text-center transition-all hover:bg-white/10">
                  <p className="text-white/50 text-xs mb-1">{s.label}</p>
                  <p className="text-white font-bold text-lg">{s.value?.toFixed(1)}<span className="text-white/30 text-sm">/10</span></p>
                </div>
              ))}
            </div>

            {/* Feedback */}
            <div className="bg-primary-900/40 border border-primary-500/20 rounded-xl px-4 py-3">
              <p className="text-primary-200 text-sm italic">{evaluation?.feedback}</p>
            </div>

            <button onClick={handleNext} className="btn-primary w-full py-4 font-bold text-lg shadow-xl shadow-primary-500/20">
              {evaluation?.interview_complete
                ? '📊 Final Results'
                : 'Next Step →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex gap-2">
          <span className="w-3 h-3 rounded-full bg-primary-400 dot-1" />
          <span className="w-3 h-3 rounded-full bg-primary-400 dot-2" />
          <span className="w-3 h-3 rounded-full bg-primary-400 dot-3" />
        </div>
      </div>
    }>
      <InterviewContent />
    </Suspense>
  );
}
