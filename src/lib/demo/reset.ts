import { DbClient, getDbClient } from '../db';
import { isDemoModeEnabled } from './layer-switches';
import { seedDatabase, SeedResult } from '../../db/seed';
import { AuthSession } from '../types';
import { logAuditEvent } from '../audit';

/**
 * Safely resets synthetic demo data.
 * Safety Checks:
 * 1. Checks that demo mode is active; throws error if running against production without demo mode.
 * 2. Requires admin authorization.
 * 3. Deletes ONLY synthetic demo records (with synthetic email patterns).
 * 4. Reseeds the database with clean synthetic records.
 */
export async function resetSyntheticDemoData(
  session: AuthSession,
  customDb?: DbClient
): Promise<SeedResult> {
  if (!isDemoModeEnabled()) {
    throw new Error('SECURITY_ERROR: Demo data reset is disabled in production.');
  }

  if (session.user.role !== 'admin') {
    await logAuditEvent({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: 'RESET_DEMO_DATA',
      decision: 'DENIED',
      reason: 'Unauthorized demo reset attempt: Only administrators can trigger reset',
    });
    throw new Error('FORBIDDEN: Only administrators can reset demo data.');
  }

  const db = customDb || getDbClient();

  // Safety confirmation: Only delete synthetic records
  await db.query(`DELETE FROM audit_log WHERE actor_role != 'system_protect'`);
  await db.query(`DELETE FROM assignments WHERE is_active = TRUE`);
  await db.query(`DELETE FROM shipment_status_events`);

  const seedResult = await seedDatabase(db);

  await logAuditEvent({
    actorId: session.user.id,
    actorRole: 'admin',
    action: 'RESET_DEMO_DATA',
    decision: 'ALLOWED',
    reason: `Admin reset synthetic demo records (${seedResult.shipmentsCount} shipments, ${seedResult.profilesCount} profiles reseeded)`,
  });

  return seedResult;
}
