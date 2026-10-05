import { DbClient } from './db';
import { Shipment, ShipmentStatus, VALID_STATUS_TRANSITIONS } from './types';
import { logAuditEvent } from './audit';

export class StateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateTransitionError';
  }
}

export class UnauthorizedTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedTransitionError';
  }
}

export function isValidTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  const allowed = VALID_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export async function verifyDriverAssignment(
  db: DbClient,
  shipmentId: string,
  driverId: string
): Promise<boolean> {
  const res = await db.query(
    `SELECT 1 FROM assignments
     WHERE shipment_id = $1 AND driver_id = $2 AND is_active = TRUE`,
    [shipmentId, driverId]
  );
  return res.rows.length > 0;
}

export interface TransitionParams {
  shipmentId: string;
  newStatus: ShipmentStatus;
  actorId: string;
  actorRole: 'driver' | 'admin';
  location: string;
  notes?: string;
  ipAddress?: string;
}

export async function updateShipmentStatus(
  db: DbClient,
  params: TransitionParams
): Promise<Shipment> {
  const { shipmentId, newStatus, actorId, actorRole, location, notes, ipAddress } = params;

  // 1. Fetch current shipment record
  const shipmentRes = await db.query<Shipment>(
    `SELECT * FROM shipments WHERE id = $1`,
    [shipmentId]
  );

  if (shipmentRes.rows.length === 0) {
    await logAuditEvent({
      actorId,
      actorRole,
      action: 'UPDATE_SHIPMENT_STATUS',
      shipmentId,
      decision: 'DENIED',
      reason: 'Shipment does not exist',
      ipAddress,
    });
    throw new StateTransitionError('Shipment not found');
  }

  const currentShipment = shipmentRes.rows[0];

  // 2. If actor is a driver, verify active assignment
  if (actorRole === 'driver') {
    const isAssigned = await verifyDriverAssignment(db, shipmentId, actorId);
    if (!isAssigned) {
      await logAuditEvent({
        actorId,
        actorRole: 'driver',
        action: 'UPDATE_SHIPMENT_STATUS',
        shipmentId,
        decision: 'DENIED',
        reason: 'Driver is not actively assigned to this shipment',
        ipAddress,
      });
      throw new UnauthorizedTransitionError(
        'Driver is not actively assigned to this shipment'
      );
    }
  }

  // 3. Verify valid state transition
  if (!isValidTransition(currentShipment.status, newStatus)) {
    const reason = `Invalid status transition from '${currentShipment.status}' to '${newStatus}' (must follow created -> assigned -> picked_up -> in_transit -> delivered)`;
    await logAuditEvent({
      actorId,
      actorRole,
      action: 'UPDATE_SHIPMENT_STATUS',
      shipmentId,
      decision: 'DENIED',
      reason,
      ipAddress,
    });
    throw new StateTransitionError(reason);
  }

  // 4. Update shipment status and location
  const updateRes = await db.query<Shipment>(
    `UPDATE shipments
     SET status = $1, current_location = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [newStatus, location, shipmentId]
  );

  // 5. Append status event
  await db.query(
    `INSERT INTO shipment_status_events (shipment_id, from_status, to_status, actor_id, location, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [shipmentId, currentShipment.status, newStatus, actorId, location, notes || '']
  );

  // 6. Log successful audit event
  await logAuditEvent({
    actorId,
    actorRole,
    action: 'UPDATE_SHIPMENT_STATUS',
    shipmentId,
    decision: 'ALLOWED',
    reason: `Status successfully updated from '${currentShipment.status}' to '${newStatus}'`,
    ipAddress,
  });

  return updateRes.rows[0];
}
