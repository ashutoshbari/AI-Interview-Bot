import { NextResponse } from 'next/server';
import { getSession } from '@/lib/store';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const candidateId = Number(params.id);
    const session = getSession(candidateId);

    const name = session?.candidate?.name || 'Candidate';
    const position = session?.candidate?.position || 'Software Engineer';

    let techTotal = 85;
    let probTotal = 88;
    let commTotal = 90;

    if (session?.answers?.length) {
        techTotal = Math.round(session.answers.reduce((acc, a) => acc + a.technical_score, 0) / session.answers.length);
        probTotal = Math.round(session.answers.reduce((acc, a) => acc + a.depth_score, 0) / session.answers.length);
        commTotal = Math.round(session.answers.reduce((acc, a) => acc + a.communication_score, 0) / session.answers.length);
    }

    const overallScore = Math.round((techTotal + probTotal + commTotal) / 3);
    const recommendation = overallScore >= 85 ? 'Strong Hire' : overallScore >= 70 ? 'Hire' : 'No Hire';

    return NextResponse.json({
        overall_score: overallScore,
        technical_score: techTotal,
        problem_solving_score: probTotal,
        communication_score: commTotal,
        strengths: [
            `Demonstrated strong grasp of core software engineering and system architecture principles for ${position}.`,
            'Clear communication style with logical step-by-step problem breakdown.',
            'Effective debugging and incident isolation techniques.',
        ],
        weaknesses: [
            'Could provide more explicit quantitative metrics when describing system scale and database indexing.',
            'Consider elaborating further on fallback mechanisms during failover scenarios.',
        ],
        improvement_plan: [
            'Deepen practical knowledge in distributed caching strategies (Redis Cluster / Memcached).',
            'Practice mock system design scenarios emphasizing latency SLAs and database sharding.',
            'Review container orchestration patterns and Kubernetes zero-downtime deployment strategies.',
            'Refine STAR method storytelling for behavioral leadership questions.',
        ],
        recommendation,
        summary: `${name} demonstrated high technical competence and clear problem-solving methodology for the ${position} role. Strong candidate recommended for final team matching.`,
    });
}
