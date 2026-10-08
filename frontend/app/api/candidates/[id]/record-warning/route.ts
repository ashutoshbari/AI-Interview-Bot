import { NextResponse } from 'next/server';
import { getSession, saveSession } from '@/lib/store';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const candidateId = Number(params.id);
        const { type } = await request.json();
        const session = getSession(candidateId);

        if (!session) {
            return NextResponse.json({ detail: 'Candidate session not found' }, { status: 404 });
        }

        if (!session.warnings) {
            session.warnings = { tabSwitchCount: 0, copyPasteCount: 0 };
        }

        if (type === 'tab_switch') {
            session.warnings.tabSwitchCount += 1;
        } else if (type === 'copy_paste') {
            session.warnings.copyPasteCount += 1;
        }

        saveSession(session);

        return NextResponse.json({
            tab_switch_count: session.warnings.tabSwitchCount,
            copy_paste_count: session.warnings.copyPasteCount,
        });
    } catch (e: any) {
        return NextResponse.json({ detail: e?.message || 'Failed to record warning' }, { status: 500 });
    }
}
