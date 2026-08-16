import { NextResponse } from 'next/server';
import { createCandidateSession } from '@/lib/store';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const name = (formData.get('name') as string) || 'Candidate';
        const mobile = (formData.get('mobile') as string) || '';
        const email = (formData.get('email') as string) || '';
        const position = (formData.get('position') as string) || 'Software Engineer';
        const resumeFile = formData.get('resume') as File | null;

        let resumeText = '';
        if (resumeFile) {
            resumeText = `Uploaded file: ${resumeFile.name} (${resumeFile.size} bytes)`;
        }

        const session = createCandidateSession(name, mobile, email, position, resumeText);

        return NextResponse.json({
            id: session.candidate.id,
            name: session.candidate.name,
            mobile: session.candidate.mobile,
            position: session.candidate.position,
            status: session.candidate.status,
            is_verified: session.candidate.isVerified,
            created_at: session.candidate.createdAt,
        });
    } catch (error: any) {
        console.error('API Register Error:', error);
        return NextResponse.json(
            { detail: error?.message || 'Registration failed' },
            { status: 500 }
        );
    }
}
