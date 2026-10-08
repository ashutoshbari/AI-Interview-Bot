import { NextResponse } from 'next/server';
import { getSessionByToken, saveSession } from '@/lib/store';

export async function POST(
    request: Request,
    { params }: { params: { token: string } }
) {
    try {
        const token = params.token;
        const session = getSessionByToken(token);

        session.status = 'completed';
        saveSession(session);

        return NextResponse.json({
            status: 'completed',
            message: 'Interview successfully finalized and submitted.',
        });
    } catch (e: any) {
        return NextResponse.json({ detail: e?.message || 'Failed to complete interview' }, { status: 500 });
    }
}
