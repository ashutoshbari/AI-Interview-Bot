import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { current_question, user_query } = await request.json();
        return NextResponse.json({
            ai_response: `Regarding "${current_question}": Focus on explaining the architectural choices, trade-offs, and step-by-step reasoning behind your decision. Specifically address: ${user_query || 'your core implementation strategy'}.`,
        });
    } catch {
        return NextResponse.json({ ai_response: 'Please elaborate on your architectural design and trade-offs.' });
    }
}
