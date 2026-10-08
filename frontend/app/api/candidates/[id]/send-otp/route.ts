import { NextResponse } from 'next/server';
import { getSession, saveSession, generateOtpCode } from '@/lib/store';
import { sendOtpEmail } from '@/lib/email';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const candidateId = Number(params.id);
        const session = getSession(candidateId);

        if (!session) {
            return NextResponse.json({ detail: 'Candidate session not found' }, { status: 404 });
        }

        // Support optional body or query parameter for resilient email targeting across serverless cold starts
        let bodyData: any = {};
        try {
            bodyData = await request.json();
        } catch {}

        const url = new URL(request.url);
        const emailFromQuery = url.searchParams.get('email');
        const targetEmail = (bodyData.email || emailFromQuery || session.candidate.email || '').trim();
        const targetName = (bodyData.name || session.candidate.name || 'Candidate').trim();

        if (targetEmail && targetEmail.includes('@')) {
            session.candidate.email = targetEmail;
        }
        if (targetName) {
            session.candidate.name = targetName;
        }

        const now = Date.now();
        // Cooldown: 30 seconds
        if (session.lastOtpSentAt && now - session.lastOtpSentAt < 30000) {
            const remaining = Math.ceil((30000 - (now - session.lastOtpSentAt)) / 1000);
            return NextResponse.json(
                { detail: `Too many OTP requests. Please wait ${remaining} seconds before requesting another code.` },
                { status: 429 }
            );
        }

        // Generate a fresh 6-digit numeric OTP code
        const freshOtp = generateOtpCode();
        session.otpCode = freshOtp;
        session.lastOtpSentAt = now;
        session.otpAttempts = 0; // reset attempts for fresh code
        saveSession(session);

        // Send OTP email
        const emailResult = await sendOtpEmail(session.candidate.email, session.candidate.name, freshOtp);

        if (!emailResult.success) {
            console.error(`[OTP] Failed to deliver OTP email to candidate ${candidateId} (${session.candidate.email}): ${emailResult.error}`);
            return NextResponse.json(
                {
                    detail: emailResult.error || 'We could not send your verification email. Please try again shortly.',
                    success: false,
                    otp_sent: false,
                },
                { status: 502 }
            );
        }

        console.log(`[OTP] Successfully dispatched OTP email to candidate ${candidateId} (${session.candidate.email})`);
        return NextResponse.json({
            success: true,
            otp_sent: true,
            message: `Verification code sent to ${session.candidate.email}`,
            channels: ['email'],
        });
    } catch (error: any) {
        console.error('API send-otp error:', error);
        return NextResponse.json(
            { detail: 'Unable to send the verification email right now.', success: false, otp_sent: false },
            { status: 500 }
        );
    }
}
