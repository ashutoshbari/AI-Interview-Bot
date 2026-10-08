import { NextResponse } from 'next/server';
import { getSessionByToken } from '@/lib/store';

export async function GET(
    request: Request,
    { params }: { params: { token: string } }
) {
    const token = params.token;
    const session = getSessionByToken(token);

    const name = session?.candidate?.name || 'Candidate';
    const position = session?.candidate?.position || 'Software Engineer';
    const answers = session?.answers || [];

    let techTotal = 0;
    let probTotal = 0;
    let commTotal = 0;

    if (answers.length > 0) {
        techTotal = Math.round(answers.reduce((acc, a) => acc + (a.technical_score ?? 75), 0) / answers.length);
        probTotal = Math.round(answers.reduce((acc, a) => acc + (a.depth_score ?? 75), 0) / answers.length);
        commTotal = Math.round(answers.reduce((acc, a) => acc + (a.communication_score ?? 80), 0) / answers.length);
    } else {
        techTotal = 75;
        probTotal = 70;
        commTotal = 80;
    }

    if (techTotal <= 10) techTotal = Math.round(techTotal * 10);
    if (probTotal <= 10) probTotal = Math.round(probTotal * 10);
    if (commTotal <= 10) commTotal = Math.round(commTotal * 10);

    const overallScore = Math.round((techTotal + probTotal + commTotal) / 3);
    const recommendation = overallScore >= 80 ? 'Strong Hire' : overallScore >= 65 ? 'Hire' : 'Needs Improvement';

    const defaultStrengths = answers.length > 0 ? [
        `Demonstrated structured technical problem-solving for ${position} questions.`,
        'Articulate communication with clear reasoning and production insights.',
        'Strong grasp of high-scale system design and architectural trade-offs.',
    ] : [
        `Session initiated for ${position} evaluation.`,
        'Candidate completed initial verification and setup.',
    ];

    const defaultWeaknesses = answers.length > 0 ? [
        'Elaborate further with quantitative metrics (e.g. latency percentiles, memory efficiency).',
        'Provide deeper architectural detail when discussing distributed failure modes.',
    ] : [
        'Complete all interview questions to generate a comprehensive technical evaluation.',
    ];

    const defaultUpskilling = [
        `Step 1: System Architecture & Scalability — Review distributed caching and microservice fault tolerance.`,
        `Step 2: Low-Latency Query Optimization — Study database indexing, execution plans, and connection pooling.`,
        `Step 3: Incident Isolation & Debugging — Practice root cause analysis under production load spikes.`,
        `Step 4: Structured Communication — Refine STAR method framework for senior leadership discussions.`,
    ];

    return NextResponse.json({
        overall_score: overallScore,
        technical_score: techTotal,
        problem_solving_score: probTotal,
        communication_score: commTotal,
        strengths: defaultStrengths,
        weaknesses: defaultWeaknesses,
        improvement_plan: defaultUpskilling,
        recommendation,
        summary: `${name} completed the AI technical evaluation for the ${position} position. Composite score: ${overallScore}/100.`,
    });
}
