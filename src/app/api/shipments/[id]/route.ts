import { NextRequest, NextResponse } from 'next/server';
import { resolveServerSession } from '@/lib/auth';
import { getDbClient } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { notFoundResponse, unauthorizedResponse, badRequestResponse } from '@/lib/errors';
import { ShipmentIdParamSchema } from '@/lib/validation';
import { Shipment } from '@/lib/types';
import { verifyDriverAssignment } from '@/lib/state-machine';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await resolveServerSession(req);
  if (!session) {
    await logAuditEvent({
      actorRole: 'anonymous',
      action: 'READ_SHIPMENT',
      decision: 'DENIED',
      reason: 'Unauthenticated request to read shipment',
    });
    return unauthorizedResponse();
  }

  const paramCheck = ShipmentIdParamSchema.safeParse(params);
  if (!paramCheck.success) {
    return badRequestResponse('Invalid shipment ID format');
  }

  const shipmentId = paramCheck.data.id;
  const db = getDbClient();

  const res = await db.query<Shipment>(
    `SELECT * FROM shipments WHERE id = $1`,
    [shipmentId]
  );

  // Anti-Enumeration Gate:
  // If shipment does not exist in database, return 404
  if (res.rows.length === 0) {
    await logAuditEvent({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: 'READ_SHIPMENT',
      shipmentId,
      decision: 'DENIED',
      reason: 'Shipment ID does not exist',
    });
    return notFoundResponse();
  }

  const shipment = res.rows[0];

  // Authorization Check
  let isAuthorized = false;

  if (session.user.role === 'admin') {
    isAuthorized = true;
  } else if (session.user.role === 'customer') {
    isAuthorized = shipment.customer_id === session.user.id;
  } else if (session.user.role === 'driver') {
    isAuthorized = await verifyDriverAssignment(db, shipment.id, session.user.id);
  }

  // Anti-Enumeration Security Principle:
  // Return the EXACT SAME 404 response for unauthorized shipment access.
  // Never disclose whether another customer's or driver's shipment exists.
  if (!isAuthorized) {
    await logAuditEvent({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: 'READ_SHIPMENT',
      shipmentId,
      decision: 'DENIED',
      reason: `Unauthorized read attempt by role '${session.user.role}' on shipment owned by '${shipment.customer_id}' (anti-enumeration 404 returned)`,
    });
    return notFoundResponse();
  }

  // Authorized read
  await logAuditEvent({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: 'READ_SHIPMENT',
    shipmentId,
    decision: 'ALLOWED',
    reason: `Authorized read of shipment ${shipment.tracking_number} by ${session.user.role}`,
  });

  return NextResponse.json({ shipment });
}
