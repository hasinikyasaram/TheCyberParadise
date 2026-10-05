import { NextRequest, NextResponse } from 'next/server';
import { resolveServerSession } from '@/lib/auth';
import { getDbClient } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { unauthorizedResponse, forbiddenResponse, badRequestResponse } from '@/lib/errors';
import { ShipmentIdParamSchema, UpdateShipmentStatusSchema } from '@/lib/validation';
import { updateShipmentStatus, StateTransitionError, UnauthorizedTransitionError } from '@/lib/state-machine';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await resolveServerSession(req);
  if (!session) {
    await logAuditEvent({
      actorRole: 'anonymous',
      action: 'UPDATE_SHIPMENT_STATUS',
      decision: 'DENIED',
      reason: 'Unauthenticated request to update status',
    });
    return unauthorizedResponse();
  }

  if (session.user.role !== 'driver' && session.user.role !== 'admin') {
    await logAuditEvent({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: 'UPDATE_SHIPMENT_STATUS',
      decision: 'DENIED',
      reason: `Role '${session.user.role}' is not permitted to update shipment status`,
    });
    return forbiddenResponse('Only drivers and administrators can update status');
  }

  const paramCheck = ShipmentIdParamSchema.safeParse(params);
  if (!paramCheck.success) {
    return badRequestResponse('Invalid shipment ID');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const parsed = UpdateShipmentStatusSchema.safeParse(body);
  if (!parsed.success) {
    return badRequestResponse('Validation failed', parsed.error.format());
  }

  const db = getDbClient();

  try {
    const updated = await updateShipmentStatus(db, {
      shipmentId: paramCheck.data.id,
      newStatus: parsed.data.status,
      actorId: session.user.id,
      actorRole: session.user.role as 'driver' | 'admin',
      location: parsed.data.location,
      notes: parsed.data.notes,
    });

    return NextResponse.json({ shipment: updated });
  } catch (err) {
    if (err instanceof UnauthorizedTransitionError) {
      return forbiddenResponse(err.message);
    }
    if (err instanceof StateTransitionError) {
      return badRequestResponse(err.message);
    }
    return badRequestResponse('Failed to update shipment status');
  }
}
