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
    // Fallback candidate session
    const candidate: Candidate = {
        id: id || 1001,
        name: 'Candidate',
        mobile: '+919876543210',
        email: 'candidate@ashvance.tech',
        position: 'Software Engineer',
        isVerified: true,
        status: 'verified',
        createdAt: new Date().toISOString(),
    };
    const questions: QuestionItem[] = [
        {
            question_order: 1,
            question_type: 'greeting',
            stage: 'greeting',
            question: `Hello and welcome to your AI technical interview with ASHVANCE TECH for the ${candidate.position} role. Could you please start by giving me a brief introduction of yourself, your technical background, and what you're passionate about building?`,
        },
        {
            question_order: 2,
            question_type: 'background',
            stage: 'background',
            question: `Thank you for introducing yourself. Looking at your engineering background, what core programming languages, frameworks, and architecture paradigms do you feel most proficient with in production?`,
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
        mobile: mobile || '+919876543210',
        email: email || 'candidate@ashvance.tech',
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
            stage: 'greeting',
            question: `Hello ${candidate.name}! Welcome to your AI technical interview with ASHVANCE TECH for the ${candidate.position} role. Could you please start by giving me a brief introduction of yourself, your background, and key areas of expertise?`,
        },
        {
            question_order: 2,
            question_type: 'background',
            stage: 'background',
            question: `Thank you for sharing, ${candidate.name}. What technologies, frameworks, and engineering methodologies have you primarily focused on throughout your journey as a ${candidate.position}?`,
        },
        {
            question_order: 3,
            question_type: 'project_deep_dive',
            stage: 'project_deep_dive',
            question: `Could you walk me through the most significant project you have engineered? What was the overall architecture, and what technical hurdles did you overcome during implementation?`,
        },
        {
            question_order: 4,
            question_type: 'technical',
            stage: 'technical',
            question: `When building high-concurrency distributed systems, how do you handle database concurrency, caching layers, and graceful degradation during network partitions?`,
        },
        {
            question_order: 5,
            question_type: 'problem_solving',
            stage: 'problem_solving',
            question: `Can you describe a challenging production bug or performance bottleneck you encountered? How did you isolate root causes and ensure resilient long-term resolution?`,
        },
        {
            question_order: 6,
            question_type: 'behavioral',
            stage: 'behavioral',
            question: `How do you approach collaboration in an agile environment when cross-functional priorities change? How do you communicate technical trade-offs to non-technical stakeholders?`,
        },
        {
            question_order: 7,
            question_type: 'candidate_questions',
            stage: 'candidate_questions',
            question: `Thank you, ${candidate.name}. That concludes our evaluation sections. Do you have any questions for ASHVANCE TECH regarding our technology roadmap or engineering vision?`,
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
