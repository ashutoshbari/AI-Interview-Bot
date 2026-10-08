import { NextResponse } from 'next/server';
import { checkSmtpHealth } from '@/lib/email';

export async function GET() {
    try {
        const health = await checkSmtpHealth();
        const statusCode = health.status === 'ready' ? 200 : 503;
        return NextResponse.json(health, { status: statusCode });
    } catch (error: any) {
        return NextResponse.json(
            {
                service: 'email',
                smtp_connection: 'error',
                authentication: 'untested',
                status: error?.message || 'Internal health check failure',
            },
            { status: 500 }
        );
    }
}
