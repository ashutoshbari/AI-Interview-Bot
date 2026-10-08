import { NextResponse } from 'next/server';
import { getSessionByToken, saveSession, generateOtpCode } from '@/lib/store';
import { sendOtpEmail } from '@/lib/email';

export async function POST(
    request: Request,
    { params }: { params: { token: string } }
) {
    try {
        const token = params.token;
        const session = getSessionByToken(token);

        if (!session) {
            return NextResponse.json({ detail: 'Token session not found' }, { status: 404 });
        }

        const now = Date.now();
        if (session.lastOtpSentAt && now - session.lastOtpSentAt < 30000) {
            const remaining = Math.ceil((30000 - (now - session.lastOtpSentAt)) / 1000);
            return NextResponse.json(
                { detail: `Too many OTP requests. Please wait ${remaining} seconds before requesting another code.` },
                { status: 429 }
            );
        }

        const freshOtp = generateOtpCode();
        session.otpCode = freshOtp;
        session.lastOtpSentAt = now;
        session.otpAttempts = 0;
        saveSession(session);

        const emailResult = await sendOtpEmail(session.candidate.email, session.candidate.name, freshOtp);
        if (!emailResult.success) {
            return NextResponse.json(
                {
                    detail: emailResult.error || 'We could not send your verification email. Please try again shortly.',
                    success: false,
                    otp_sent: false,
                },
                { status: 502 }
            );
        }

        return NextResponse.json({
            success: true,
            otp_sent: true,
            message: `Verification code sent to ${session.candidate.email}`,
            channels: ['email'],
        });
    } catch (error: any) {
        return NextResponse.json(
            { detail: 'Unable to send the verification email right now.', success: false, otp_sent: false },
            { status: 500 }
        );
    }
}
