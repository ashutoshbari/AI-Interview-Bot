import { NextResponse } from 'next/server';
import { getSession } from '@/lib/store';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const candidateId = Number(params.id);
    const session = getSession(candidateId);
    const position = session?.candidate?.position || 'Software Engineer';

    return NextResponse.json({
        overall_score: 82,
        verdict: 'Recommended for Progression',
        verdict_reason: `Demonstrated strong core capabilities for ${position}. Candidate shows structured technical articulation and solid architectural foundations.`,
        top_strengths: [
            {
                title: 'Structured Engineering Thought Process',
                detail: 'Breaks complex business requirements into clean, decoupled service components.',
            },
            {
                title: 'Clear Verbal Articulation',
                detail: 'Explains technical trade-offs with clarity, precision, and confidence.',
            },
        ],
        growth_areas: [
            {
                title: 'Quantitative Performance Metrics',
                detail: 'Support system architecture statements with target throughput (RPS), p99 latency thresholds, and cache hit ratios.',
            },
        ],
        quick_wins: [
            'Adopt the STAR method (Situation, Task, Action, Result) for behavioral scenarios.',
            'Mention distributed tracing (OpenTelemetry) when discussing incident observability.',
        ],
        coaching_roadmap: [
            {
                week: 'Week 1',
                focus: 'High-Scale Distributed Caching',
                action: 'Study Redis cluster patterns, cache stampede prevention, and write-through vs write-back caching.',
                resource: 'Designing Data-Intensive Applications (DDIA) - Ch 3 & 5',
            },
            {
                week: 'Week 2',
                focus: 'Database Concurrency & Indexing',
                action: 'Analyze PostgreSQL B-Tree query plans and optimistic locking strategies.',
                resource: 'Use The Index, Luke (SQL Indexing Guide)',
            },
            {
                week: 'Week 3',
                focus: 'Microservice Resilience & Circuit Breakers',
                action: 'Implement circuit breaking, exponential backoff with jitter, and dead letter queues.',
                resource: 'Martin Fowler: Circuit Breaker Architecture',
            },
            {
                week: 'Week 4',
                focus: 'Mock Executive Presentations',
                action: 'Practice articulating technical trade-offs to engineering directors and non-technical partners.',
                resource: 'ASHVANCE TECH Engineering Leadership Rubrics',
            },
        ],
        interview_style_tips: [
            'Pause for 2 seconds before answering complex questions to organize your architectural points.',
            'State your assumptions explicitly upfront before giving your design recommendations.',
        ],
        encouragement: 'Great job completing your ASHVANCE TECH interview! Your foundations are strong, and with these targeted roadmap items, you are well-positioned for senior engineering roles.',
    });
}
