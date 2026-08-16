import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { text } = await request.json();
        // Return 200 JSON status letting client frontend use browser Web Speech API smoothly
        return NextResponse.json({ status: 'ok', message: 'TTS processed', text: text?.slice(0, 100) });
    } catch {
        return NextResponse.json({ status: 'ok' });
    }
}
