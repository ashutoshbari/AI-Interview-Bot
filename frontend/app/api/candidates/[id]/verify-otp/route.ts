import { NextResponse } from 'next/server';
import { getSession, saveSession } from '@/lib/store';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const candidateId = Number(params.id);
        const { otp_code } = await request.json();
        const session = getSession(candidateId);

        if (!session) {
            return NextResponse.json({ detail: 'Candidate session not found' }, { status: 404 });
        }

        // Master OTP 123456 or sent code
        if (otp_code === '123456' || otp_code === session.otpCode) {
            session.candidate.isVerified = true;
            session.candidate.status = 'verified';
            session.status = 'verified';
            saveSession(session);
            return NextResponse.json({
                verified: true,
                message: 'OTP verified successfully',
            });
        }

        return NextResponse.json(
            { verified: false, message: 'Invalid OTP code. Please try again or use 123456.' },
            { status: 400 }
        );
    } catch (e: any) {
        return NextResponse.json({ detail: e?.message || 'Verification failed' }, { status: 500 });
    }
}
