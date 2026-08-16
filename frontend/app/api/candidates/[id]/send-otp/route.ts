import { NextResponse } from 'next/server';
import { getSession } from '@/lib/store';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    const candidateId = Number(params.id);
    const session = getSession(candidateId);

    if (!session) {
        return NextResponse.json({ detail: 'Candidate session not found' }, { status: 404 });
    }

    return NextResponse.json({
        message: `OTP sent to ${session.candidate.email}`,
        channels: ['email'],
    });
}
