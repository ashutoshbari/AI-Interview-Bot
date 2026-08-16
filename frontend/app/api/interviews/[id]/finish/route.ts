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

    return NextResponse.json({ status: 'completed', message: 'Interview completed successfully' });
}
