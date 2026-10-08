export interface Candidate {
    id: number;
    secure_token?: string;
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
    lastOtpSentAt?: number;
    otpAttempts?: number;
    warnings?: {
        tabSwitchCount: number;
        copyPasteCount: number;
    };
}

export function generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Global sessions map for serverless execution runtime
const globalSessions: Record<number, SessionData> = {};
const tokenSessions: Record<string, SessionData> = {};

function createDefaultQuestions(name: string, position: string): QuestionItem[] {
    return [
        {
            question_order: 1,
            question_type: 'greeting',
            stage: 'greeting',
            question: `Hello ${name}! Welcome to your AI technical interview with ASHVANCE TECH for the ${position} role. Could you please start by giving me a brief introduction of yourself, your background, and key areas of expertise?`,
        },
        {
            question_order: 2,
            question_type: 'background',
            stage: 'background',
            question: `Thank you for introducing yourself, ${name}. What core programming languages, frameworks, and architecture paradigms do you feel most proficient with in production?`,
        },
        {
            question_order: 3,
            question_type: 'project_deep_dive',
            stage: 'project_deep_dive',
            question: `Let's dive into your engineering experience. Could you walk me through the most technically challenging project you engineered? What was your architectural approach, and how did you resolve complex bottlenecks?`,
        },
        {
            question_order: 4,
            question_type: 'technical',
            stage: 'technical',
            question: `Suppose you need to design a high-throughput, low-latency microservice handling thousands of requests per second. How would you design caching strategies, database query indexing, and asynchronous job processing?`,
        },
        {
            question_order: 5,
            question_type: 'problem_solving',
            stage: 'problem_solving',
            question: `How do you diagnose and debug difficult production incidents, such as memory leaks, high CPU spikes, or intermittent distributed timeouts? Walk me through your step-by-step diagnostic workflow.`,
        },
        {
            question_order: 6,
            question_type: 'behavioral',
            stage: 'behavioral',
            question: `Engineering often involves trade-offs between clean code architecture and aggressive delivery deadlines. Can you share an example of how you balanced engineering velocity with long-term code maintainability?`,
        },
        {
            question_order: 7,
            question_type: 'candidate_questions',
            stage: 'candidate_questions',
            question: `That concludes our technical evaluation stages. Do you have any questions for ASHVANCE TECH regarding our engineering culture, technical challenges, or growth opportunities?`,
        },
    ];
}

export function getSession(id: number): SessionData | undefined {
    if (globalSessions[id]) return globalSessions[id];
    
    // Check if session is stored by token
    for (const token in tokenSessions) {
        if (tokenSessions[token].candidate.id === id) {
            globalSessions[id] = tokenSessions[token];
            return tokenSessions[token];
        }
    }

    // Fallback candidate session
    const candidateId = id || 1001;
    const token = `ashvance_${candidateId}_token`;
    const candidate: Candidate = {
        id: candidateId,
        secure_token: token,
        name: 'Candidate',
        mobile: '+919876543210',
        email: 'candidate@ashvance.tech',
        position: 'Software Engineer',
        isVerified: true,
        status: 'verified',
        createdAt: new Date().toISOString(),
    };

    const fallbackSession: SessionData = {
        candidate,
        otpCode: '123456',
        questions: createDefaultQuestions('Candidate', 'Software Engineer'),
        answers: [],
        currentQuestionIndex: 0,
        status: 'verified',
        warnings: { tabSwitchCount: 0, copyPasteCount: 0 },
    };

    globalSessions[candidateId] = fallbackSession;
    tokenSessions[token] = fallbackSession;
    return fallbackSession;
}

export function getSessionByToken(token: string): SessionData {
    if (tokenSessions[token]) return tokenSessions[token];

    // Check if matching candidate exists in globalSessions
    for (const id in globalSessions) {
        if (globalSessions[id].candidate.secure_token === token) {
            tokenSessions[token] = globalSessions[id];
            return globalSessions[id];
        }
    }

    // Generate valid session dynamically for this token
    const id = Date.now();
    const candidate: Candidate = {
        id,
        secure_token: token,
        name: 'Candidate',
        mobile: '+919876543210',
        email: 'candidate@ashvance.tech',
        position: 'Software Engineer',
        isVerified: true,
        status: 'verified',
        createdAt: new Date().toISOString(),
    };

    const session: SessionData = {
        candidate,
        otpCode: '123456',
        questions: createDefaultQuestions('Candidate', 'Software Engineer'),
        answers: [],
        currentQuestionIndex: 0,
        status: 'verified',
        warnings: { tabSwitchCount: 0, copyPasteCount: 0 },
    };

    tokenSessions[token] = session;
    globalSessions[id] = session;
    return session;
}

export function saveSession(session: SessionData): void {
    globalSessions[session.candidate.id] = session;
    if (session.candidate.secure_token) {
        tokenSessions[session.candidate.secure_token] = session;
    }
}

export function createCandidateSession(
    name: string,
    mobile: string,
    email: string,
    position: string,
    resumeText: string = ''
): SessionData {
    const id = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const secureToken = `ashvance_sec_${id}_${randomSuffix}`;

    const candidate: Candidate = {
        id,
        secure_token: secureToken,
        name: name || 'Candidate',
        mobile: mobile || '+919876543210',
        email: email || 'candidate@ashvance.tech',
        position: position || 'Software Engineer',
        resumeText,
        isVerified: false,
        status: 'registered',
        createdAt: new Date().toISOString(),
    };

    const session: SessionData = {
        candidate,
        otpCode: '123456',
        questions: createDefaultQuestions(candidate.name, candidate.position),
        answers: [],
        currentQuestionIndex: 0,
        status: 'registered',
        warnings: { tabSwitchCount: 0, copyPasteCount: 0 },
    };

    saveSession(session);
    return session;
}
