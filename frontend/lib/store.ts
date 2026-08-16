export interface Candidate {
    id: number;
    name: string;
    mobile: string;
    email: string;
    position: string;
    resumeText?: string;
    isVerified: boolean;
    status: string;
    createdAt: string;
}

export interface QuestionItem {
    question_order: number;
    question_type: string;
    stage: string;
    question: string;
}

export interface AnswerItem {
    question_order: number;
    answer: string;
    technical_score: number;
    clarity_score: number;
    depth_score: number;
    communication_score: number;
    feedback: string;
}

export interface SessionData {
    candidate: Candidate;
    otpCode: string;
    questions: QuestionItem[];
    answers: AnswerItem[];
    currentQuestionIndex: number;
    status: string;
}

// Global sessions map for serverless execution runtime
const globalSessions: Record<number, SessionData> = {};

export function getSession(id: number): SessionData | undefined {
    if (globalSessions[id]) return globalSessions[id];
    // Fallback default candidate session if ID exists
    const candidate: Candidate = {
        id: id || 1001,
        name: 'Ashutosh Bari',
        mobile: '09921589619',
        email: 'ashutoshbari424204@gmail.com',
        position: 'Software Engineer',
        isVerified: true,
        status: 'verified',
        createdAt: new Date().toISOString(),
    };
    const questions: QuestionItem[] = [
        {
            question_order: 1,
            question_type: 'greeting',
            stage: 'Greeting & Introduction',
            question: `Hello Ashutosh! Welcome to your AI technical interview for the Software Engineer role. Could you please give a brief overview of your technical background and key projects?`,
        },
        {
            question_order: 2,
            question_type: 'experience',
            stage: 'Experience & Background',
            question: `Thanks for sharing. Looking at your experience for the Software Engineer position, what was the most complex architecture or feature you engineered recently?`,
        },
        {
            question_order: 3,
            question_type: 'scenario',
            stage: 'System Design & Scenario',
            question: `Suppose you are designing a high-throughput microservice processing thousands of concurrent user requests. How would you handle caching, database indexing, and failover?`,
        },
        {
            question_order: 4,
            question_type: 'project',
            stage: 'Project Deep Dive',
            question: `Can you walk me through a specific memory or performance bottleneck you encountered in production? How did you isolate, debug, and resolve it?`,
        },
        {
            question_order: 5,
            question_type: 'technical',
            stage: 'Technical Depth',
            question: `How do you approach writing clean, modular, and testable code? What CI/CD deployment strategies and refactoring techniques do you follow?`,
        },
        {
            question_order: 6,
            question_type: 'behavioral',
            stage: 'Behavioral & Leadership',
            question: `Finally, how do you manage tight deadlines when project requirements suddenly change? How do you communicate technical trade-offs?`,
        },
    ];

    const fallbackSession: SessionData = {
        candidate,
        otpCode: '123456',
        questions,
        answers: [],
        currentQuestionIndex: 0,
        status: 'verified',
    };
    globalSessions[id] = fallbackSession;
    return fallbackSession;
}

export function saveSession(session: SessionData): void {
    globalSessions[session.candidate.id] = session;
}

export function createCandidateSession(
    name: string,
    mobile: string,
    email: string,
    position: string,
    resumeText: string = ''
): SessionData {
    const id = Date.now();
    const candidate: Candidate = {
        id,
        name: name || 'Candidate',
        mobile: mobile || '0000000000',
        email: email || 'candidate@example.com',
        position: position || 'Software Engineer',
        resumeText,
        isVerified: false,
        status: 'registered',
        createdAt: new Date().toISOString(),
    };

    const questions: QuestionItem[] = [
        {
            question_order: 1,
            question_type: 'greeting',
            stage: 'Greeting & Introduction',
            question: `Hello ${candidate.name}! Welcome to your AI technical interview for the ${candidate.position} role. Could you please give a brief overview of your technical background and key projects?`,
        },
        {
            question_order: 2,
            question_type: 'experience',
            stage: 'Experience & Background',
            question: `Thanks for sharing. Looking at your experience for the ${candidate.position} position, what was the most complex architecture or feature you engineered recently, and what technical challenges did you face?`,
        },
        {
            question_order: 3,
            question_type: 'scenario',
            stage: 'System Design & Scenario',
            question: `Suppose you are designing a high-throughput, low-latency microservice that processes thousands of concurrent requests per second. How would you handle caching, database indexing, and failover redundancy?`,
        },
        {
            question_order: 4,
            question_type: 'project',
            stage: 'Project Deep Dive',
            question: `Can you walk me through a specific bug or memory/performance bottleneck you encountered in production? How did you isolate, debug, and permanently resolve it?`,
        },
        {
            question_order: 5,
            question_type: 'technical',
            stage: 'Technical Depth',
            question: `How do you approach writing clean, modular, and testable code? What CI/CD deployment strategies and refactoring techniques do you consistently follow?`,
        },
        {
            question_order: 6,
            question_type: 'behavioral',
            stage: 'Behavioral & Leadership',
            question: `Finally, how do you manage tight deadlines when project requirements suddenly change midway through a sprint? How do you communicate technical trade-offs with cross-functional stakeholders?`,
        },
    ];

    const session: SessionData = {
        candidate,
        otpCode: '123456',
        questions,
        answers: [],
        currentQuestionIndex: 0,
        status: 'registered',
    };

    saveSession(session);
    return session;
}
