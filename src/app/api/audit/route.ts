import { NextRequest, NextResponse } from 'next/server';
import { resolveServerSession } from '@/lib/auth';
import { getAuditLogsForAdmin } from '@/lib/audit';
import { unauthorizedResponse, forbiddenResponse } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await resolveServerSession(req);
  if (!session) {
    return unauthorizedResponse('Authentication required to view audit logs');
  }

  if (session.user.role !== 'admin') {
    return forbiddenResponse('Security Alert: Audit logs are restricted to administrators');
  }

  try {
    const logs = await getAuditLogsForAdmin(session.user.id, 100);
    return NextResponse.json({ logs });
  } catch (err: any) {
    return forbiddenResponse(err.message || 'Access denied');
  }
}
