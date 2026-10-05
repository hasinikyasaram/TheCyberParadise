import { NextRequest, NextResponse } from 'next/server';
import { resolveServerSession } from '@/lib/auth';
import { getDbClient } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { unauthorizedResponse, forbiddenResponse, badRequestResponse, notFoundResponse } from '@/lib/errors';
import { ShipmentIdParamSchema, AssignDriverSchema } from '@/lib/validation';
import { Shipment, Profile } from '@/lib/types';

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
      action: 'ASSIGN_DRIVER',
      decision: 'DENIED',
      reason: 'Unauthenticated driver assignment attempt',
    });
    return unauthorizedResponse();
  }

  if (session.user.role !== 'admin') {
    await logAuditEvent({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: 'ASSIGN_DRIVER',
      decision: 'DENIED',
      reason: `Unauthorized assignment attempt: Role '${session.user.role}' cannot assign drivers`,
    });
    return forbiddenResponse('Only administrators can assign drivers');
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

  const parsed = AssignDriverSchema.safeParse(body);
  if (!parsed.success) {
    return badRequestResponse('Validation failed', parsed.error.format());
  }

  const db = getDbClient();
  const shipmentId = paramCheck.data.id;
  const driverId = parsed.data.driver_id;

  // Verify shipment exists
  const shipmentRes = await db.query<Shipment>(
    `SELECT * FROM shipments WHERE id = $1`,
    [shipmentId]
  );
  if (shipmentRes.rows.length === 0) {
    return notFoundResponse();
  }

  // Verify driver exists and has 'driver' role
  const driverRes = await db.query<Profile>(
    `SELECT * FROM profiles WHERE id = $1 AND role = 'driver'`,
    [driverId]
  );
  if (driverRes.rows.length === 0) {
    return badRequestResponse('Target user is not a valid driver');
  }

  // Deactivate any existing active assignments for this shipment
  await db.query(
    `UPDATE assignments SET is_active = FALSE WHERE shipment_id = $1`,
    [shipmentId]
  );

  // Insert new active assignment
  await db.query(
    `INSERT INTO assignments (shipment_id, driver_id, assigned_by, is_active)
     VALUES ($1, $2, $3, TRUE)`,
    [shipmentId, driverId, session.user.id]
  );

  // Transition shipment status to 'assigned' if it was 'created'
  if (shipmentRes.rows[0].status === 'created') {
    await db.query(
      `UPDATE shipments SET status = 'assigned', updated_at = NOW() WHERE id = $1`,
      [shipmentId]
    );

    await db.query(
      `INSERT INTO shipment_status_events (shipment_id, from_status, to_status, actor_id, location, notes)
       VALUES ($1, 'created', 'assigned', $2, $3, 'Driver assigned by admin')`,
      [shipmentId, session.user.id, shipmentRes.rows[0].current_location]
    );
  }

  await logAuditEvent({
    actorId: session.user.id,
    actorRole: 'admin',
    action: 'ASSIGN_DRIVER',
    shipmentId,
    decision: 'ALLOWED',
    reason: `Driver ${driverId} assigned to shipment ${shipmentId}`,
  });

  return NextResponse.json({ success: true, shipment_id: shipmentId, driver_id: driverId });
}
