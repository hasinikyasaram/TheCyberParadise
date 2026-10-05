import { NextRequest, NextResponse } from 'next/server';
import { resolveServerSession } from '@/lib/auth';
import { resetSyntheticDemoData } from '@/lib/demo/reset';
import { unauthorizedResponse, forbiddenResponse, badRequestResponse } from '@/lib/errors';
import { isDemoModeEnabled } from '@/lib/demo/layer-switches';

export async function POST(req: NextRequest) {
  if (!isDemoModeEnabled()) {
    return forbiddenResponse('Demo reset is strictly disabled in production environment');
  }

  const session = await resolveServerSession(req);
  if (!session) {
    return unauthorizedResponse('Authentication required to reset demo data');
  }

  if (session.user.role !== 'admin') {
    return forbiddenResponse('Security Alert: Only administrators can trigger demo data reset');
  }

  try {
    const result = await resetSyntheticDemoData(session);
    return NextResponse.json({
      success: true,
      message: 'Synthetic demo data successfully reseeded.',
      result,
    });
  } catch (err: any) {
    return badRequestResponse(err.message || 'Demo reset failed');
  }
}
