import { NextResponse } from 'next/server';
import { getSession, saveSession } from '@/lib/store';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const candidateId = Number(params.id);
        const { question_order, answer } = await request.json();
        const session = getSession(candidateId);

        if (!session) {
            return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
        }

        const answerLength = (answer || '').trim().length;
        let technicalScore = 75;
        let clarityScore = 80;
        let depthScore = 70;
        let communicationScore = 85;
        let feedback = 'Good response covering key technical aspects.';

        if (answerLength > 150) {
            technicalScore = 90;
            clarityScore = 88;
            depthScore = 92;
            communicationScore = 90;
            feedback = 'Detailed and comprehensive technical response showing deep architectural understanding.';
        } else if (answerLength < 30) {
            technicalScore = 60;
            clarityScore = 65;
            depthScore = 55;
            communicationScore = 65;
            feedback = 'Answer was concise. Adding more implementation details and architectural trade-offs will improve your score.';
        }

        session.answers.push({
            question_order,
            answer: answer || '',
            technical_score: technicalScore,
            clarity_score: clarityScore,
            depth_score: depthScore,
            communication_score: communicationScore,
            feedback,
        });

        const nextIndex = session.answers.length;
        const nextQuestion = session.questions[nextIndex] || undefined;
        const interviewComplete = nextIndex >= session.questions.length;

        if (interviewComplete) {
            session.status = 'completed';
        }
        saveSession(session);

        return NextResponse.json({
            technical_score: technicalScore,
            clarity_score: clarityScore,
            depth_score: depthScore,
            communication_score: communicationScore,
            feedback,
            next_question: nextQuestion,
            interview_complete: interviewComplete,
        });
    } catch (e: any) {
        return NextResponse.json({ detail: e?.message || 'Answer evaluation failed' }, { status: 500 });
    }
}
