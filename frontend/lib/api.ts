import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export interface TranscriptionResponse {
    text: string;
}

const api = axios.create({
    baseURL: API_BASE,
    timeout: 90000,
    headers: {
        'bypass-tunnel-reminder': 'true',
        'Bypass-Tunnel-Reminder': 'true',
    },
});

export interface CandidateResponse {
    id: number;
    name: string;
    mobile: string;
    position?: string;
    status: string;
    secure_token?: string;
    total_score?: number;
    is_verified?: boolean;
    created_at: string;
}

export interface Question {
    question_order: number;
    question_type: string;
    stage: string;
    question: string;
}

export interface EvaluationResponse {
    technical_score: number;
    clarity_score: number;
    depth_score: number;
    communication_score: number;
    feedback: string;
    next_question?: Question;
    interview_complete: boolean;
}

// Strength/weakness can be string OR {title, detail} object
export type StrengthItem = string | { title: string; detail: string };
export type UpskillingItem = string | { topic: string; resource: string; priority?: string };

export interface Report {
    overall_score?: number;
    technical_score: number;
    problem_solving_score: number;
    communication_score: number;
    depth_score?: number;
    strengths: StrengthItem[];
    weaknesses: StrengthItem[];
    improvement_plan: string[];
    upskilling_plan?: UpskillingItem[];
    interview_coaching?: string[];
    recommendation: string;
    summary?: string;
}

export interface SuggestionRoadmapItem {
    week: string;
    focus: string;
    action: string;
    resource: string;
}

export interface Suggestions {
    overall_score: number;
    verdict: string;
    verdict_reason: string;
    top_strengths: StrengthItem[];
    growth_areas: StrengthItem[];
    quick_wins: string[];
    coaching_roadmap: SuggestionRoadmapItem[];
    interview_style_tips: string[];
    encouragement: string;
}

// Register candidate with resume upload
export async function registerCandidate(formData: FormData): Promise<CandidateResponse> {
    try {
        const response = await api.post<CandidateResponse>('/api/candidates/register', formData);
        return response.data;
    } catch (error) {
        console.error('Registration API Error:', error);
        throw error;
    }
}

// Poll candidate status
export async function getCandidateStatus(candidateId: number): Promise<{ status: string; name: string }> {
    const response = await api.get(`/api/candidates/${candidateId}/status`);
    return response.data;
}

// Get generated questions
export async function getQuestions(candidateId: number): Promise<Question[]> {
    const response = await api.get<Question[]>(`/api/interviews/${candidateId}/questions`);
    return response.data;
}

// Submit answer and get evaluation
export async function submitAnswer(
    candidateId: number,
    questionOrder: number,
    answer: string
): Promise<EvaluationResponse> {
    const response = await api.post<EvaluationResponse>(`/api/interviews/${candidateId}/answer`, {
        question_order: questionOrder,
        answer,
    });
    return response.data;
}

// Get / generate report
export async function getReport(candidateId: number): Promise<Report> {
    const response = await api.get<Report>(`/api/reports/${candidateId}`);
    return response.data;
}

// Get AI coaching suggestions (rich personalized feedback)
export async function getSuggestions(candidateId: number): Promise<Suggestions> {
    const response = await api.get<Suggestions>(`/api/interviews/${candidateId}/suggestions`);
    return response.data;
}

// Get PDF download URL
export function getPdfUrl(candidateId: number): string {
    return `${API_BASE}/api/reports/${candidateId}/pdf`;
}

export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResponse> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'answer.webm');
    const response = await api.post<TranscriptionResponse>('/api/interviews/transcribe', formData);
    return response.data;
}

// Play TTS via backend (female voice MP3)
export async function playTTS(text: string): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/api/interviews/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
            body: JSON.stringify({ text: text.slice(0, 1000) }),
        });
        if (!response.ok) throw new Error('TTS failed');
        const blob = await response.blob();
        if (blob.size < 100) throw new Error('Empty audio');
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();
    } catch {
        // Fallback: Web Speech API
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.pitch = 1.15;
            utterance.rate = 0.92;
            const voices = window.speechSynthesis.getVoices();
            utterance.voice = voices.find(v =>
                v.name.includes('Samantha') || v.name.includes('Karen') ||
                v.name.includes('Victoria') || v.name.includes('Zira') ||
                v.lang === 'en-GB'
            ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
            window.speechSynthesis.speak(utterance);
        }
    }
}

// Send OTP
export async function sendOTP(candidateId: number): Promise<{ message: string; channels: string[] }> {
    const response = await api.post(`/api/candidates/${candidateId}/send-otp`);
    return response.data;
}

// Verify OTP
export async function verifyOTP(candidateId: number, otpCode: string): Promise<{ verified: boolean; message: string }> {
    const response = await api.post(`/api/candidates/${candidateId}/verify-otp`, { otp_code: otpCode });
    return response.data;
}

// Record Anti-Cheat Warning
export async function recordWarning(candidateId: number, type: 'tab_switch' | 'copy_paste'): Promise<{ tab_switch_count: number; copy_paste_count: number }> {
    const response = await api.post(`/api/candidates/${candidateId}/record-warning`, { type });
    return response.data;
}

// Ask AI / Clarify Question
export async function clarifyQuestion(candidateId: number, currentQuestion: string, userQuery: string): Promise<{ ai_response: string }> {
    const response = await api.post<{ ai_response: string }>(`/api/interviews/${candidateId}/clarify`, {
        current_question: currentQuestion,
        user_query: userQuery,
    });
    return response.data;
}

// Explicitly submit and finish interview
export async function finishInterview(candidateId: number): Promise<{ status: string; message: string }> {
    const response = await api.post(`/api/interviews/${candidateId}/finish`);
    return response.data;
}

// ── Secure Token API Methods for Public Interview Links ──────────────────────

export interface CandidateTokenInfo {
    valid: boolean;
    candidate_id: number;
    secure_token: string;
    name: string;
    email: string;
    mobile: string;
    position: string;
    status: string;
    is_verified: boolean;
    current_stage: string;
    is_completed: boolean;
    created_at: string;
}

export async function getCandidateByToken(token: string): Promise<CandidateTokenInfo> {
    const response = await api.get<CandidateTokenInfo>(`/api/candidates/token/${token}`);
    return response.data;
}

export async function verifyOTPByToken(token: string, otpCode: string): Promise<{ verified: boolean; message: string; candidate_id?: number }> {
    const response = await api.post(`/api/candidates/token/${token}/verify-otp`, { otp_code: otpCode });
    return response.data;
}

export async function getQuestionsByToken(token: string): Promise<Question[]> {
    const response = await api.get<Question[]>(`/api/interviews/token/${token}/questions`);
    return response.data;
}

export async function submitAnswerByToken(
    token: string,
    questionOrder: number,
    answer: string
): Promise<EvaluationResponse> {
    const response = await api.post<EvaluationResponse>(`/api/interviews/token/${token}/answer`, {
        question_order: questionOrder,
        answer,
    });
    return response.data;
}

export async function clarifyQuestionByToken(
    token: string,
    currentQuestion: string,
    userQuery: string
): Promise<{ ai_response: string }> {
    const response = await api.post<{ ai_response: string }>(`/api/interviews/token/${token}/clarify`, {
        current_question: currentQuestion,
        user_query: userQuery,
    });
    return response.data;
}

export async function finishInterviewByToken(token: string): Promise<{ status: string; message: string }> {
    const response = await api.post(`/api/interviews/token/${token}/finish`);
    return response.data;
}

export async function getReportByToken(token: string): Promise<Report> {
    const response = await api.get<Report>(`/api/reports/token/${token}`);
    return response.data;
}

export function getPdfUrlByToken(token: string): string {
    return `${API_BASE}/api/reports/token/${token}/pdf`;
}

export default api;
