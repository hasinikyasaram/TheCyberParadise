import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { resolveServerSession } from '@/lib/auth';
import { getDbClient } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { CreateShipmentSchema } from '@/lib/validation';
import { unauthorizedResponse, forbiddenResponse, badRequestResponse } from '@/lib/errors';
import { Shipment } from '@/lib/types';

export async function GET(req: NextRequest) {
  const session = await resolveServerSession(req);
  if (!session) {
    await logAuditEvent({
      actorRole: 'anonymous',
      action: 'LIST_SHIPMENTS',
      decision: 'DENIED',
      reason: 'Unauthenticated request to list shipments',
    });
    return unauthorizedResponse();
  }

  const db = getDbClient();
  let shipments: Shipment[] = [];

  if (session.user.role === 'customer') {
    const res = await db.query<Shipment>(
      `SELECT * FROM shipments WHERE customer_id = $1 ORDER BY created_at DESC`,
      [session.user.id]
    );
    shipments = res.rows;
  } else if (session.user.role === 'driver') {
    const res = await db.query<Shipment>(
      `SELECT s.* FROM shipments s
       INNER JOIN assignments a ON a.shipment_id = s.id
       WHERE a.driver_id = $1 AND a.is_active = TRUE
       ORDER BY s.created_at DESC`,
      [session.user.id]
    );
    shipments = res.rows;
  } else if (session.user.role === 'admin') {
    const res = await db.query<Shipment>(
      `SELECT * FROM shipments ORDER BY created_at DESC`
    );
    shipments = res.rows;
  }

  await logAuditEvent({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: 'LIST_SHIPMENTS',
    decision: 'ALLOWED',
    reason: `Retrieved ${shipments.length} authorized shipments for ${session.user.role}`,
  });

  return NextResponse.json({ shipments });
}

export async function POST(req: NextRequest) {
  const session = await resolveServerSession(req);
  if (!session) {
    await logAuditEvent({
      actorRole: 'anonymous',
      action: 'CREATE_SHIPMENT',
      decision: 'DENIED',
      reason: 'Unauthenticated request to create shipment',
    });
    return unauthorizedResponse();
  }

  if (session.user.role !== 'customer' && session.user.role !== 'admin') {
    await logAuditEvent({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: 'CREATE_SHIPMENT',
      decision: 'DENIED',
      reason: `Role '${session.user.role}' is not authorized to create shipments`,
    });
    return forbiddenResponse('Only customers and admins can create shipments');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const parsed = CreateShipmentSchema.safeParse(body);
  if (!parsed.success) {
    return badRequestResponse('Validation failed', parsed.error.format());
  }

  const { origin_city, destination_city, delivery_address, notes } = parsed.data;

  // Never trust customer_id from client; use session user id
  const customerId = session.user.id;
  const trackingNumber = 'ST-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const rawToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const db = getDbClient();
  const insertRes = await db.query<Shipment>(
    `INSERT INTO shipments (
       tracking_number, tracking_token_hash, customer_id, status,
       origin_city, destination_city, delivery_address, notes
     )
     VALUES ($1, $2, $3, 'created', $4, $5, $6, $7)
     RETURNING *`,
    [trackingNumber, tokenHash, customerId, origin_city, destination_city, delivery_address, notes]
  );

  const newShipment = insertRes.rows[0];

  await logAuditEvent({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: 'CREATE_SHIPMENT',
    shipmentId: newShipment.id,
    decision: 'ALLOWED',
    reason: `Shipment created with tracking ${trackingNumber}`,
  });

  return NextResponse.json(
    {
      shipment: newShipment,
      public_tracking_token: rawToken, // Returned once upon creation for customer tracking
    },
    { status: 201 }
  );
}
