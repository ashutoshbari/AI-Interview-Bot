import { NextResponse } from 'next/server';
import { createCandidateSession } from '@/lib/store';

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const rawName = (formData.get('name') as string) || '';
        const rawMobile = (formData.get('mobile') as string) || '';
        const rawEmail = (formData.get('email') as string) || '';
        const rawPosition = (formData.get('position') as string) || 'Software Engineer';
        const resumeFile = formData.get('resume') as File | null;

        // 1. Name validation
        const name = rawName.trim();
        if (!name || name.length < 2) {
            return NextResponse.json(
                { detail: 'Name must be at least 2 characters long.' },
                { status: 400 }
            );
        }

        // 2. Email validation
        const email = rawEmail.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return NextResponse.json(
                { detail: 'Please enter a valid email address.' },
                { status: 400 }
            );
        }

        // 3. Indian mobile validation
        const mobileClean = rawMobile.replace(/[\s\-]/g, '');
        const digitsOnly = mobileClean.replace(/^(\+91|91)/, '');
        if (!/^[6-9]\d{9}$/.test(digitsOnly)) {
            return NextResponse.json(
                { detail: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.' },
                { status: 400 }
            );
        }
        const normalizedMobile = `+91${digitsOnly}`;

        // 4. Resume file validation
        if (!resumeFile || typeof resumeFile === 'string' || resumeFile.size === 0) {
            return NextResponse.json(
                { detail: 'A valid resume file (PDF, DOC, or DOCX) is required.' },
                { status: 400 }
            );
        }

        const ext = '.' + (resumeFile.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return NextResponse.json(
                { detail: `Unsupported file type '${ext}'. Please upload a PDF, DOC, or DOCX resume.` },
                { status: 400 }
            );
        }

        if (resumeFile.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json(
                { detail: `Resume file exceeds maximum limit of 10MB (${(resumeFile.size / (1024 * 1024)).toFixed(1)}MB).` },
                { status: 400 }
            );
        }

        const resumeText = `Uploaded file: ${resumeFile.name} (${resumeFile.size} bytes)`;
        const session = createCandidateSession(name, normalizedMobile, email, rawPosition.trim(), resumeText);

        return NextResponse.json({
            id: session.candidate.id,
            secure_token: session.candidate.secure_token,
            name: session.candidate.name,
            email: session.candidate.email,
            mobile: session.candidate.mobile,
            position: session.candidate.position,
            status: session.candidate.status,
            is_verified: session.candidate.isVerified,
            created_at: session.candidate.createdAt,
        });
    } catch (error: any) {
        console.error('API Register Error:', error);
        return NextResponse.json(
            { detail: error?.message || 'Registration failed. Please check your inputs and try again.' },
            { status: 500 }
        );
    }
}
