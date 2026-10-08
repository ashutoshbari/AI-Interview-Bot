import { NextResponse } from 'next/server';
import { getSessionByToken } from '@/lib/store';

export async function POST(
    request: Request,
    { params }: { params: { token: string } }
) {
    try {
        const token = params.token;
        const body = await request.json();
        const currentQuestion = body.current_question || '';
        const userQuery = body.user_query || '';
        const session = getSessionByToken(token);

        const aiResponse = `Regarding your query "${userQuery}": For this question ("${currentQuestion.slice(0, 80)}..."), focus on real-world engineering architecture, technical trade-offs, and your hands-on implementation experience as a ${session.candidate.position}. Structure your explanation clearly with context, action, and results.`;

        return NextResponse.json({
            ai_response: aiResponse,
        });
    } catch (e: any) {
        return NextResponse.json({ detail: e?.message || 'Clarification failed' }, { status: 500 });
    }
}
