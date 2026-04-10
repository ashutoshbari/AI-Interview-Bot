import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface TranscriptionResponse {
    text: string;
}

const api = axios.create({
    baseURL: API_BASE,
    timeout: 60000,
});

export interface CandidateResponse {
    id: number;
    name: string;
    mobile: string;
    position?: string;
    status: string;
    total_score?: number;
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

export interface Report {
    technical_score: number;
    problem_solving_score: number;
    communication_score: number;
    strengths: string[];
    weaknesses: string[];
    improvement_plan: string[];
    recommendation: string;
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

export default api;
