import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveServerSession } from '@/lib/auth';
import { getLayerSwitches, updateLayerSwitches, isDemoModeEnabled } from '@/lib/demo/layer-switches';
import { forbiddenResponse, badRequestResponse, unauthorizedResponse } from '@/lib/errors';

const UpdateLayerSwitchesSchema = z.object({
  bypassServerAuthCheck: z.boolean().optional(),
  bypassAppStateMachineCheck: z.boolean().optional(),
  bypassAntiEnumeration: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  if (!isDemoModeEnabled()) {
    return forbiddenResponse('Demo layer switches are disabled outside demo mode');
  }

  const session = await resolveServerSession(req);
  if (!session || session.user.role !== 'admin') {
    return forbiddenResponse('Only administrators can inspect demo layer switches');
  }

  const switches = getLayerSwitches(session.user.role);
  return NextResponse.json({ switches, demo_mode: true });
}

export async function POST(req: NextRequest) {
  if (!isDemoModeEnabled()) {
    return forbiddenResponse('Demo layer switches are disabled outside demo mode');
  }

  const session = await resolveServerSession(req);
  if (!session) {
    return unauthorizedResponse('Authentication required');
  }

  if (session.user.role !== 'admin') {
    return forbiddenResponse('Only administrators can configure demo layer switches');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const parsed = UpdateLayerSwitchesSchema.safeParse(body);
  if (!parsed.success) {
    return badRequestResponse('Validation failed', parsed.error.format());
  }

  try {
    const updated = updateLayerSwitches(parsed.data, session.user.role);
    return NextResponse.json({ switches: updated });
  } catch (err: any) {
    return forbiddenResponse(err.message);
  }
}
