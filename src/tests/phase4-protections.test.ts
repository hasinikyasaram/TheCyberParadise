import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { createInMemoryDb, setTestDbClient } from '../lib/db';
import { applyFieldLevelAddressPrivacy } from '../lib/privacy';
import { GET as trackByTokenRoute } from '../app/api/track/[token]/route';
import { GET as suspiciousSummaryRoute } from '../app/api/copilot/suspicious-summary/route';
import { resetRateLimitsForTesting, checkRateLimit } from '../lib/rate-limiter';
import { Shipment } from '../types';

describe('Phase 4 — Advanced Privacy & Resilience Protections', () => {
  let db: ReturnType<typeof createInMemoryDb>;

  const customerAlice = {
    id: '12121212-1212-4212-8212-121212121212',
    role: 'customer' as const,
    full_name: 'Customer Alice',
    email: 'alice@test.local',
  };

  const driverDave = {
    id: '34343434-3434-4434-8434-343434343434',
    role: 'driver' as const,
    full_name: 'Driver Dave',
    email: 'dave@test.local',
  };

  const adminUser = {
    id: '78787878-7878-4878-8878-787878787878',
    role: 'admin' as const,
    full_name: 'Security Admin',
    email: 'admin@test.local',
  };

  beforeEach(async () => {
    db = createInMemoryDb();
    setTestDbClient(db);
    resetRateLimitsForTesting();

    for (const p of [customerAlice, driverDave, adminUser]) {
      await db.query(
        `INSERT INTO profiles (id, role, full_name, email) VALUES ($1, $2, $3, $4)`,
        [p.id, p.role, p.full_name, p.email]
      );
    }
  });

  // --------------------------------------------------------------------------
  // 1. FIELD-LEVEL ADDRESS PRIVACY
  // --------------------------------------------------------------------------
  describe('Field-Level Address Privacy', () => {
    const rawShipment: Shipment = {
      id: '99887766-5544-4321-8765-112233445566',
      tracking_number: 'ST-ADDR-TEST',
      tracking_token_hash: 'addrhash',
      customer_id: customerAlice.id,
      status: 'in_transit',
      origin_city: 'Delhi',
      destination_city: 'Bengaluru',
      delivery_address: 'Apartment 402, High-Tech Towers, Indiranagar',
      current_location: 'Highway 44',
      notes: 'Fragile equipment',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('allows driver to access full address while actively assigned and in-transit', () => {
      const activeShipment = { ...rawShipment, status: 'in_transit' as const };
      const masked = applyFieldLevelAddressPrivacy(activeShipment, { user: driverDave }, true);
      expect(masked.delivery_address).toBe('Apartment 402, High-Tech Towers, Indiranagar');
    });

    it('redacts delivery address from driver immediately upon delivery', () => {
      const deliveredShipment = { ...rawShipment, status: 'delivered' as const };
      const masked = applyFieldLevelAddressPrivacy(deliveredShipment, { user: driverDave }, true);
      expect(masked.delivery_address).toContain('[REDACTED — Address access terminated upon delivery]');
      expect(masked.delivery_address).not.toContain('Apartment 402');
    });

    it('redacts delivery address if driver is not actively assigned (reassignment)', () => {
      const inTransitShipment = { ...rawShipment, status: 'in_transit' as const };
      // isActiveDriverAssignment is false (e.g. reassigned to another driver)
      const masked = applyFieldLevelAddressPrivacy(inTransitShipment, { user: driverDave }, false);
      expect(masked.delivery_address).toContain('[REDACTED — Driver is not actively assigned]');
      expect(masked.delivery_address).not.toContain('Apartment 402');
    });

    it('preserves full address for the owning customer and admin', () => {
      const maskedAlice = applyFieldLevelAddressPrivacy(rawShipment, { user: customerAlice }, false);
      expect(maskedAlice.delivery_address).toBe('Apartment 402, High-Tech Towers, Indiranagar');

      const maskedAdmin = applyFieldLevelAddressPrivacy(rawShipment, { user: adminUser }, false);
      expect(maskedAdmin.delivery_address).toBe('Apartment 402, High-Tech Towers, Indiranagar');
    });
  });

  // --------------------------------------------------------------------------
  // 2. CRYPTOGRAPHIC PUBLIC TRACKING TOKENS
  // --------------------------------------------------------------------------
  describe('Cryptographic Public Tracking Tokens', () => {
    it('returns only coarse status and location, zero PII or address', async () => {
      const rawToken = 'secret-public-token-1234567890abcdef123456';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await db.query(
        `INSERT INTO shipments (
           tracking_number, tracking_token_hash, customer_id, status,
           origin_city, destination_city, delivery_address, current_location, notes
         )
         VALUES ($1, $2, $3, 'in_transit', 'Hyderabad', 'Mumbai', 'Secret Penthouse 101', 'Pune Hub', 'Confidential note')`,
        ['ST-PUB-TRACK', tokenHash, customerAlice.id]
      );

      const req = new NextRequest(`http://localhost/api/track/${rawToken}`);
      const res = await trackByTokenRoute(req, { params: { token: rawToken } });

      expect(res.status).toBe(200);
      const data = await res.json();

      // Coarse tracking data present
      expect(data.tracking_number).toBe('ST-PUB-TRACK');
      expect(data.status).toBe('in_transit');
      expect(data.current_location).toBe('Pune Hub');
      expect(data.origin_city).toBe('Hyderabad');
      expect(data.destination_city).toBe('Mumbai');

      // Zero personal data or sensitive fields disclosed!
      expect(data.delivery_address).toBeUndefined();
      expect(data.customer_id).toBeUndefined();
      expect(data.customer_name).toBeUndefined();
      expect(data.phone).toBeUndefined();
      expect(data.notes).toBeUndefined();
      expect(JSON.stringify(data)).not.toContain('Secret Penthouse');
      expect(JSON.stringify(data)).not.toContain('Confidential note');
    });

    it('detects repeated failed lookups, records a security alert, and blocks subsequent requests', async () => {
      const invalidToken = 'invalid-token-probe-1234567890abcdef';
      const attackerIp = '198.51.100.42';

      // Execute 5 failed lookups from the same IP
      for (let i = 0; i < 5; i++) {
        const req = new NextRequest(`http://localhost/api/track/${invalidToken}`, {
          headers: { 'x-forwarded-for': attackerIp },
        });
        const res = await trackByTokenRoute(req, { params: { token: invalidToken } });
        expect(res.status).toBe(404);
      }

      // Verify that security alert was recorded in audit_log
      const alertLogs = await db.query(
        `SELECT * FROM audit_log WHERE action = 'SECURITY_ALERT_PROBING_DETECTED'`
      );
      expect(alertLogs.rows.length).toBeGreaterThan(0);
      expect(alertLogs.rows[0].reason).toContain('Probing attack detected');

      // The 6th attempt from the same IP must now be BLOCKED with HTTP 429
      const blockedReq = new NextRequest(`http://localhost/api/track/${invalidToken}`, {
        headers: { 'x-forwarded-for': attackerIp },
      });
      const blockedRes = await trackByTokenRoute(blockedReq, { params: { token: invalidToken } });
      expect(blockedRes.status).toBe(429);
      const blockedData = await blockedRes.json();
      expect(blockedData.error).toBe('TOO_MANY_REQUESTS');
    });
  });

  // --------------------------------------------------------------------------
  // 3. ADMIN COPILOT SUSPICIOUS EVENT SUMMARY
  // --------------------------------------------------------------------------
  describe('Admin Suspicious Security Events Summary', () => {
    it('summarizes suspicious events for admins and remains strictly read-only', async () => {
      const req = new NextRequest('http://localhost/api/copilot/suspicious-summary', {
        headers: { 'x-user-id': adminUser.id },
      });
      const res = await suspiciousSummaryRoute(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.read_only).toBe(true);
      expect(data.summary).toBeDefined();
      expect(typeof data.total_suspicious_events).toBe('number');
    });

    it('denies access to suspicious summary for non-admins', async () => {
      const req = new NextRequest('http://localhost/api/copilot/suspicious-summary', {
        headers: { 'x-user-id': customerAlice.id },
      });
      const res = await suspiciousSummaryRoute(req);
      expect(res.status).toBe(403);
    });
  });
});
