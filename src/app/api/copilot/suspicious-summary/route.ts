import { NextRequest, NextResponse } from 'next/server';
import { resolveServerSession } from '@/lib/auth';
import { summarizeSuspiciousEvents } from '@/lib/ai/suspicious-summary';
import { unauthorizedResponse, forbiddenResponse } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await resolveServerSession(req);
  if (!session) {
    return unauthorizedResponse('Authentication required');
  }

  if (session.user.role !== 'admin') {
    return forbiddenResponse('Restricted: Only administrators can access suspicious security summaries');
  }

  try {
    const summary = await summarizeSuspiciousEvents(session);
    return NextResponse.json(summary);
  } catch (err: any) {
    return forbiddenResponse(err.message || 'Access denied');
  }
}
