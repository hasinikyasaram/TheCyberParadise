import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveServerSession } from '@/lib/auth';
import { executeCopilotQuery, CopilotAccessDeniedError } from '@/lib/ai/copilot';
import { unauthorizedResponse, forbiddenResponse, badRequestResponse, notFoundResponse } from '@/lib/errors';
import { UuidSchema } from '@/lib/validation';

const CopilotQuerySchema = z.object({
  query: z.string().min(1).max(500).trim(),
  shipment_id: UuidSchema.optional(),
});

export async function POST(req: NextRequest) {
  const session = await resolveServerSession(req);
  if (!session) {
    return unauthorizedResponse('Authentication required to access AI Copilot');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const parsed = CopilotQuerySchema.safeParse(body);
  if (!parsed.success) {
    return badRequestResponse('Validation failed', parsed.error.format());
  }

  try {
    const response = await executeCopilotQuery({
      query: parsed.data.query,
      shipmentId: parsed.data.shipment_id,
      session,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    if (err instanceof CopilotAccessDeniedError) {
      // Anti-enumeration: Return not found for unauthorized/nonexistent shipment queries
      return notFoundResponse();
    }
    return badRequestResponse('Copilot query failed');
  }
}
