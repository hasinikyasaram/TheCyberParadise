import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryDb, setTestDbClient } from '../lib/db';
import { runAttackScenario, runAllScenarios } from '../lib/demo/attack-scenarios';
import { getLayerSwitches, updateLayerSwitches, isDemoModeEnabled } from '../lib/demo/layer-switches';

describe('Phase 3 — Attack Lab & Defense-in-Depth Observability', () => {
  let db: ReturnType<typeof createInMemoryDb>;

  beforeEach(() => {
    db = createInMemoryDb();
    setTestDbClient(db);
    process.env.DEMO_MODE = 'true';
  });

  it('Scenario 1: Cross-customer shipment read is BLOCKED with real audit link', async () => {
    const res = await runAttackScenario('cross_customer_read');
    expect(res.status).toBe('BLOCKED');
    expect(res.httpStatus).toBe(404);
    expect(res.auditEntryId).toBeDefined();
    expect(res.auditDetails?.decision).toBe('DENIED');
  });

  it('Scenario 2: Wrong-driver shipment update is BLOCKED with real audit link', async () => {
    const res = await runAttackScenario('wrong_driver_update');
    expect(res.status).toBe('BLOCKED');
    expect(res.httpStatus).toBe(403);
    expect(res.auditEntryId).toBeDefined();
    expect(res.auditDetails?.decision).toBe('DENIED');
  });

  it('Scenario 3: Skipped workflow step is BLOCKED by state machine integrity', async () => {
    const res = await runAttackScenario('skipped_workflow_step');
    expect(res.status).toBe('BLOCKED');
    expect(res.httpStatus).toBe(400);
    expect(res.auditEntryId).toBeDefined();
    expect(res.auditDetails?.decision).toBe('DENIED');
  });

  it('Scenario 4: Direct DB query with wrong credentials returns zero rows', async () => {
    const res = await runAttackScenario('direct_db_wrong_credentials');
    expect(res.status).toBe('BLOCKED');
    expect(res.safeReason).toContain('0 rows');
  });

  it('Scenario 5: Prompt injection through synthetic note is BLOCKED', async () => {
    const res = await runAttackScenario('prompt_injection_note');
    expect(res.status).toBe('BLOCKED');
    expect(res.safeReason).toContain('refused');
  });

  it('Scenario 6: Shipment ID enumeration probe is BLOCKED with same-404', async () => {
    const res = await runAttackScenario('id_enumeration');
    expect(res.status).toBe('BLOCKED');
    expect(res.httpStatus).toBe(404);
  });

  it('Scorecard: dynamically computes exact attacks blocked ratio (never hardcoded)', async () => {
    const scorecard = await runAllScenarios();
    expect(scorecard.totalAttacks).toBe(6);
    expect(scorecard.blockedAttacks).toBe(6);
    expect(scorecard.allowedAttacks).toBe(0);
    expect(scorecard.blockRatePercentage).toBe(100);
    expect(scorecard.results.length).toBe(6);
  });

  it('Demo layer switches fail closed for non-admin actors and outside demo mode', () => {
    // Non-admin cannot obtain layer switches
    const nonAdminSwitches = getLayerSwitches('customer');
    expect(nonAdminSwitches.bypassServerAuthCheck).toBe(false);
    expect(nonAdminSwitches.bypassAppStateMachineCheck).toBe(false);

    // Non-admin cannot toggle switches
    expect(() => updateLayerSwitches({ bypassServerAuthCheck: true }, 'customer')).toThrow();

    // Production mode without DEMO_MODE flag fails closed
    const prevEnv = process.env.NODE_ENV;
    const prevDemo = process.env.DEMO_MODE;
    try {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.DEMO_MODE;

      expect(isDemoModeEnabled()).toBe(false);
      const prodSwitches = getLayerSwitches('admin');
      expect(prodSwitches.bypassServerAuthCheck).toBe(false);
    } finally {
      (process.env as any).NODE_ENV = prevEnv;
      process.env.DEMO_MODE = prevDemo;
    }
  });
});
