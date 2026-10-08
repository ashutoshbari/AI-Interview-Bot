import { NextResponse } from 'next/server';
import { getSession, saveSession } from '@/lib/store';

const MAX_ATTEMPTS = 5;

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

        const cleanedCode = String(otp_code || '').trim();

        // Already verified idempotency
        if (session.candidate.isVerified) {
            return NextResponse.json({
                verified: true,
                message: 'Identity verified successfully',
            });
        }

        // Validate attempt count
        const currentAttempts = session.otpAttempts || 0;
        if (currentAttempts >= MAX_ATTEMPTS) {
            return NextResponse.json(
                { detail: 'Maximum verification attempts exceeded. Please request a new verification code.' },
                { status: 429 }
            );
        }

        // Validate 6 digits
        if (!/^\d{6}$/.test(cleanedCode)) {
            return NextResponse.json(
                { detail: 'Verification code must be exactly 6 numeric digits.' },
                { status: 400 }
            );
        }

        // Check against active session OTP
        if (cleanedCode === session.otpCode) {
            session.candidate.isVerified = true;
            session.candidate.status = 'verified';
            session.status = 'verified';
            session.otpCode = ''; // Invalidate OTP after successful verification (single-use)
            session.otpAttempts = 0;
            saveSession(session);

            return NextResponse.json({
                verified: true,
                message: 'Identity verified successfully',
            });
        }

        // Increment attempts on failure
        session.otpAttempts = currentAttempts + 1;
        saveSession(session);
        const remaining = MAX_ATTEMPTS - session.otpAttempts;

        return NextResponse.json(
            {
                verified: false,
                detail: `Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Please request a new code.'}`,
            },
            { status: 400 }
        );
    } catch (e: any) {
        return NextResponse.json({ detail: e?.message || 'Verification failed' }, { status: 500 });
    }
}
