import { NextResponse } from 'next/server';
import { getSession, saveSession } from '@/lib/store';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    const candidateId = Number(params.id);
    const session = getSession(candidateId);

    if (session) {
        session.status = 'completed';
        saveSession(session);
    }

    const email = session?.candidate?.email;
    const name = session?.candidate?.name || 'Candidate';
    const position = session?.candidate?.position || 'Software Engineer';
    const answers = session?.answers || [];

    let techTotal = 75;
    let probTotal = 75;
    let commTotal = 80;

    if (answers.length > 0) {
        techTotal = Math.round(answers.reduce((acc, a) => acc + (a.technical_score ?? 75), 0) / answers.length);
        probTotal = Math.round(answers.reduce((acc, a) => acc + (a.depth_score ?? 75), 0) / answers.length);
        commTotal = Math.round(answers.reduce((acc, a) => acc + (a.communication_score ?? 80), 0) / answers.length);
    }

    const overallScore = Math.round((techTotal + probTotal + commTotal) / 3);
    const recommendation = overallScore >= 80 ? 'Strong Hire' : overallScore >= 65 ? 'Hire' : 'Needs Improvement';

    return NextResponse.json({
        status: 'completed',
        candidate_id: candidateId,
        candidate_name: name,
        email: email,
        overall_score: overallScore,
        recommendation: recommendation,
        pdf_report_url: `/api/reports/${candidateId}/pdf`,
        message: 'Interview completed. Scorecard generated and ready.'
    });
}
