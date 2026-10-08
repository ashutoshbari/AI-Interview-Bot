import { NextResponse } from 'next/server';
import { getSessionByToken } from '@/lib/store';

export async function GET(
    request: Request,
    { params }: { params: { token: string } }
) {
    try {
        const token = params.token;
        if (!token) {
            return NextResponse.json({ detail: 'Token required' }, { status: 400 });
        }

        const session = getSessionByToken(token);
        const nextQIndex = session.answers?.length || 0;
        const currentStage = session.questions[nextQIndex]?.stage || 'greeting';

        return NextResponse.json({
            valid: true,
            candidate_id: session.candidate.id,
            secure_token: session.candidate.secure_token || token,
            name: session.candidate.name,
            email: session.candidate.email,
            mobile: session.candidate.mobile,
            position: session.candidate.position,
            status: session.candidate.status,
            is_verified: session.candidate.isVerified,
            current_stage: currentStage,
            is_completed: session.status === 'completed',
            created_at: session.candidate.createdAt,
        });
    } catch (error: any) {
        return NextResponse.json(
            { detail: error?.message || 'Failed to retrieve candidate token session' },
            { status: 500 }
        );
    }
}
