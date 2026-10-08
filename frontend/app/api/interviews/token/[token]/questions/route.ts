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
        return NextResponse.json(session.questions);
    } catch (error: any) {
        return NextResponse.json({ detail: error?.message || 'Failed to fetch questions' }, { status: 500 });
    }
}
