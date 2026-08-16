import { NextResponse } from 'next/server';
import { getSession } from '@/lib/store';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const candidateId = Number(params.id);
    const session = getSession(candidateId);

    if (!session) {
        return NextResponse.json({ detail: 'Interview session not found' }, { status: 404 });
    }

    return NextResponse.json(session.questions);
}
