import { NextResponse } from 'next/server';
import { getSession } from '@/lib/store';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const candidateId = Number(params.id);
    const session = getSession(candidateId);

    if (!session) {
        return NextResponse.json({ detail: 'Candidate not found' }, { status: 404 });
    }

    return NextResponse.json({
        status: session.candidate.status,
        name: session.candidate.name,
    });
}
