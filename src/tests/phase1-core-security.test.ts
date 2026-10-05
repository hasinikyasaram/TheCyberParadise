import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createInMemoryDb, setTestDbClient } from '../lib/db';
import { GET as getShipments, POST as createShipment } from '../app/api/shipments/route';
import { GET as getShipmentById } from '../app/api/shipments/[id]/route';
import { POST as updateShipmentStatusRoute } from '../app/api/shipments/[id]/status/route';
import { POST as assignDriverRoute } from '../app/api/shipments/[id]/assign/route';
import { GET as getAuditRoute } from '../app/api/audit/route';
import { updateShipmentStatus, StateTransitionError, UnauthorizedTransitionError } from '../lib/state-machine';
import { logAuditEvent, getAuditLogsForAdmin } from '../lib/audit';

describe('Phase 1 — Core Security Release Gate', () => {
  let db: ReturnType<typeof createInMemoryDb>;

  // Synthetic Test Personas
  const adminUser = {
    id: '11111111-1111-4111-8111-111111111111',
    role: 'admin',
    full_name: 'Security Admin',
    email: 'admin@shiptrack.local',
  };

  const customerAlice = {
    id: '22222222-2222-4222-8222-222222222222',
    role: 'customer',
    full_name: 'Customer Alice',
    email: 'alice@shiptrack.local',
  };

  const customerBob = {
    id: '33333333-3333-4333-8333-333333333333',
    role: 'customer',
    full_name: 'Customer Bob',
    email: 'bob@shiptrack.local',
  };

  const driverDave = {
    id: '44444444-4444-4444-8444-444444444444',
    role: 'driver',
    full_name: 'Driver Dave',
    email: 'dave@shiptrack.local',
  };

  const driverEve = {
    id: '55555555-5555-4555-8555-555555555555',
    role: 'driver',
    full_name: 'Driver Eve',
    email: 'eve@shiptrack.local',
  };

  beforeEach(async () => {
    db = createInMemoryDb();
    setTestDbClient(db);

    // Seed synthetic profiles
    for (const p of [adminUser, customerAlice, customerBob, driverDave, driverEve]) {
      await db.query(
        `INSERT INTO profiles (id, role, full_name, email) VALUES ($1, $2, $3, $4)`,
        [p.id, p.role, p.full_name, p.email]
      );
    }
  });

  // --------------------------------------------------------------------------
  // 1. STATE MACHINE ENFORCEMENT
  // --------------------------------------------------------------------------
  describe('State Machine & Assignment Verification', () => {
    it('enforces exact sequence: created -> assigned -> picked_up -> in_transit -> delivered', async () => {
      // 1. Insert initial shipment
      const shipRes = await db.query(
        `INSERT INTO shipments (
           tracking_number, tracking_token_hash, customer_id, status, origin_city, destination_city, delivery_address
         )
         VALUES ($1, $2, $3, 'created', 'Hyderabad', 'Bengaluru', 'Plot 42 Cyber City')
         RETURNING id`,
        ['ST-TEST01', 'hash01', customerAlice.id]
      );
      const shipmentId = shipRes.rows[0].id;

      // Assign driver Dave
      await db.query(
        `INSERT INTO assignments (shipment_id, driver_id, assigned_by, is_active)
         VALUES ($1, $2, $3, TRUE)`,
        [shipmentId, driverDave.id, adminUser.id]
      );
      await db.query(`UPDATE shipments SET status = 'assigned' WHERE id = $1`, [shipmentId]);

      // Transition to picked_up
      const s1 = await updateShipmentStatus(db, {
        shipmentId,
        newStatus: 'picked_up',
        actorId: driverDave.id,
        actorRole: 'driver',
        location: 'Hyderabad Hub',
      });
      expect(s1.status).toBe('picked_up');

      // Transition to in_transit
      const s2 = await updateShipmentStatus(db, {
        shipmentId,
        newStatus: 'in_transit',
        actorId: driverDave.id,
        actorRole: 'driver',
        location: 'National Highway 44',
      });
      expect(s2.status).toBe('in_transit');

      // Transition to delivered
      const s3 = await updateShipmentStatus(db, {
        shipmentId,
        newStatus: 'delivered',
        actorId: driverDave.id,
        actorRole: 'driver',
        location: 'Bengaluru Destination',
      });
      expect(s3.status).toBe('delivered');
    });

    it('rejects skipped workflow step (e.g. created -> in_transit or picked_up -> delivered)', async () => {
      const shipRes = await db.query(
        `INSERT INTO shipments (
           tracking_number, tracking_token_hash, customer_id, status, origin_city, destination_city, delivery_address
         )
         VALUES ($1, $2, $3, 'created', 'Delhi', 'Mumbai', 'Sector 5')
         RETURNING id`,
        ['ST-SKIP01', 'hashskip', customerAlice.id]
      );
      const shipmentId = shipRes.rows[0].id;

      // Assign driver Dave
      await db.query(
        `INSERT INTO assignments (shipment_id, driver_id, assigned_by, is_active)
         VALUES ($1, $2, $3, TRUE)`,
        [shipmentId, driverDave.id, adminUser.id]
      );

      // Attempt to jump from 'created' directly to 'in_transit'
      await expect(
        updateShipmentStatus(db, {
          shipmentId,
          newStatus: 'in_transit',
          actorId: driverDave.id,
          actorRole: 'driver',
          location: 'Highway',
        })
      ).rejects.toThrow(StateTransitionError);

      // Verify status in DB remains 'created'
      const check = await db.query(`SELECT status FROM shipments WHERE id = $1`, [shipmentId]);
      expect(check.rows[0].status).toBe('created');
    });

    it('denies driver updates if driver is not actively assigned to the shipment', async () => {
      const shipRes = await db.query(
        `INSERT INTO shipments (
           tracking_number, tracking_token_hash, customer_id, status, origin_city, destination_city, delivery_address
         )
         VALUES ($1, $2, $3, 'assigned', 'Chennai', 'Kochi', 'Dock 3')
         RETURNING id`,
        ['ST-UNASSIGNED', 'hashunassigned', customerAlice.id]
      );
      const shipmentId = shipRes.rows[0].id;

      // Dave is assigned, but Eve attempts to update status!
      await db.query(
        `INSERT INTO assignments (shipment_id, driver_id, assigned_by, is_active)
         VALUES ($1, $2, $3, TRUE)`,
        [shipmentId, driverDave.id, adminUser.id]
      );

      await expect(
        updateShipmentStatus(db, {
          shipmentId,
          newStatus: 'picked_up',
          actorId: driverEve.id, // Eve is NOT assigned!
          actorRole: 'driver',
          location: 'Chennai Hub',
        })
      ).rejects.toThrow(UnauthorizedTransitionError);

      // Verify denial was recorded in audit_log
      const audits = await db.query(
        `SELECT * FROM audit_log WHERE shipment_id = $1 AND decision = 'DENIED'`,
        [shipmentId]
      );
      expect(audits.rows.length).toBeGreaterThan(0);
      expect(audits.rows[0].reason).toContain('Driver is not actively assigned');
    });
  });

  // --------------------------------------------------------------------------
  // 2. ANTI-ENUMERATION SAME-404 RESPONSE BEHAVIOR
  // --------------------------------------------------------------------------
  describe('Anti-Enumeration Same-404 Behavior', () => {
    it('returns the exact same 404 response for nonexistent IDs and unauthorized customer IDs', async () => {
      // 1. Create a shipment owned by Alice
      const shipRes = await db.query(
        `INSERT INTO shipments (
           tracking_number, tracking_token_hash, customer_id, status, origin_city, destination_city, delivery_address
         )
         VALUES ($1, $2, $3, 'created', 'Pune', 'Nagpur', 'Civil Lines 12')
         RETURNING id`,
        ['ST-ALICE01', 'hashalice01', customerAlice.id]
      );
      const aliceShipmentId = shipRes.rows[0].id;
      const nonexistentId = '99999999-9999-4999-8999-999999999999';

      // Non-existent request by Bob
      const reqNonExistent = new NextRequest(
        `http://localhost/api/shipments/${nonexistentId}`,
        {
          headers: { 'x-user-id': customerBob.id },
        }
      );
      const resNonExistent = await getShipmentById(reqNonExistent, {
        params: { id: nonexistentId },
      });
      const dataNonExistent = await resNonExistent.json();

      // Unauthorized cross-customer request by Bob for Alice's shipment
      const reqUnauthorized = new NextRequest(
        `http://localhost/api/shipments/${aliceShipmentId}`,
        {
          headers: { 'x-user-id': customerBob.id },
        }
      );
      const resUnauthorized = await getShipmentById(reqUnauthorized, {
        params: { id: aliceShipmentId },
      });
      const dataUnauthorized = await resUnauthorized.json();

      // Both must return identical HTTP 404 status
      expect(resNonExistent.status).toBe(404);
      expect(resUnauthorized.status).toBe(404);

      // Both must return identical response bodies
      expect(dataNonExistent).toEqual(dataUnauthorized);
      expect(dataUnauthorized.error).toBe('NOT_FOUND');
      expect(dataUnauthorized.message).toBe('Shipment not found');

      // The denied attempt must be logged in audit_log
      const audits = await db.query(
        `SELECT * FROM audit_log WHERE actor_id = $1 AND decision = 'DENIED'`,
        [customerBob.id]
      );
      expect(audits.rows.length).toBe(2);
    });

    it('allows authorized customer to read their own shipment', async () => {
      const shipRes = await db.query(
        `INSERT INTO shipments (
           tracking_number, tracking_token_hash, customer_id, status, origin_city, destination_city, delivery_address
         )
         VALUES ($1, $2, $3, 'created', 'Pune', 'Nagpur', 'Civil Lines 12')
         RETURNING id`,
        ['ST-ALICE02', 'hashalice02', customerAlice.id]
      );
      const aliceShipmentId = shipRes.rows[0].id;

      const req = new NextRequest(`http://localhost/api/shipments/${aliceShipmentId}`, {
        headers: { 'x-user-id': customerAlice.id },
      });
      const res = await getShipmentById(req, { params: { id: aliceShipmentId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.shipment.id).toBe(aliceShipmentId);
      expect(data.shipment.tracking_number).toBe('ST-ALICE02');
    });
  });

  // --------------------------------------------------------------------------
  // 3. AUDIT LOGGING & ADMIN PRIVILEGES
  // --------------------------------------------------------------------------
  describe('Append-Only Audit Log & Access Controls', () => {
    it('logs both allowed and denied actions and sanitizes sensitive data', async () => {
      await logAuditEvent({
        actorId: customerAlice.id,
        actorRole: 'customer',
        action: 'TEST_ACTION',
        decision: 'ALLOWED',
        reason: 'Authorized action with bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 token',
      });

      const logs = await db.query(`SELECT * FROM audit_log WHERE actor_id = $1`, [customerAlice.id]);
      expect(logs.rows.length).toBe(1);
      expect(logs.rows[0].decision).toBe('ALLOWED');
      // Token must be sanitized
      expect(logs.rows[0].reason).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(logs.rows[0].reason).toContain('[REDACTED_TOKEN]');
    });

    it('permits only admins to inspect security audit logs', async () => {
      // Normal customer Alice attempts to read audit logs
      const reqCustomer = new NextRequest('http://localhost/api/audit', {
        headers: { 'x-user-id': customerAlice.id },
      });
      const resCustomer = await getAuditRoute(reqCustomer);
      expect(resCustomer.status).toBe(403);

      // Admin attempts to read audit logs
      const reqAdmin = new NextRequest('http://localhost/api/audit', {
        headers: { 'x-user-id': adminUser.id },
      });
      const resAdmin = await getAuditRoute(reqAdmin);
      expect(resAdmin.status).toBe(200);
      const dataAdmin = await resAdmin.json();
      expect(Array.isArray(dataAdmin.logs)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. SERVER-SIDE AUTHORIZATION & INPUT VALIDATION
  // --------------------------------------------------------------------------
  describe('Input Validation & Role Gating', () => {
    it('rejects invalid UUID parameter formats with HTTP 400', async () => {
      const invalidId = 'not-a-valid-uuid';
      const req = new NextRequest(`http://localhost/api/shipments/${invalidId}`, {
        headers: { 'x-user-id': adminUser.id },
      });
      const res = await getShipmentById(req, { params: { id: invalidId } });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('BAD_REQUEST');
    });

    it('never trusts client-supplied role or customer_id in POST body', async () => {
      const spoofBody = {
        origin_city: 'Jaipur',
        destination_city: 'Udaipur',
        delivery_address: 'Hawa Mahal Road 10',
        customer_id: customerBob.id, // Alice tries to attribute shipment to Bob!
        role: 'admin', // Alice tries to spoof admin role!
      };

      const req = new NextRequest('http://localhost/api/shipments', {
        method: 'POST',
        headers: {
          'x-user-id': customerAlice.id, // Alice is authenticated
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(spoofBody),
      });

      const res = await createShipment(req);
      expect(res.status).toBe(201);
      const data = await res.json();

      // Verified: customer_id in DB must be Alice (the authenticated session), NOT Bob!
      expect(data.shipment.customer_id).toBe(customerAlice.id);
      expect(data.shipment.customer_id).not.toBe(customerBob.id);
    });
  });
});
