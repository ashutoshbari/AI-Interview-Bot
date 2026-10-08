import { NextResponse } from 'next/server';
import { getSessionByToken, saveSession } from '@/lib/store';

export async function POST(
    request: Request,
    { params }: { params: { token: string } }
) {
    try {
        const token = params.token;
        const body = await request.json();
        const otpCode = String(body.otp_code || '').trim();

        if (!token) {
            return NextResponse.json({ detail: 'Token required' }, { status: 400 });
        }

        const session = getSessionByToken(token);

        // Verification check
        if (otpCode.length === 6) {
            session.candidate.isVerified = true;
            session.candidate.status = 'verified';
            session.status = 'verified';
            saveSession(session);

            return NextResponse.json({
                verified: true,
                message: 'Identity verified successfully',
                candidate_id: session.candidate.id,
            });
        }

        return NextResponse.json(
            { verified: false, message: 'Invalid 6-digit verification code.' },
            { status: 400 }
        );
    } catch (e: any) {
        return NextResponse.json({ detail: e?.message || 'Verification failed' }, { status: 500 });
    }
}
