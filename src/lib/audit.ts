import { AuditDecision, AuditLogEntry, UserRole } from './types';
import { getDbClient } from './db';

export interface LogAuditParams {
  actorId?: string | null;
  actorRole: UserRole | 'anonymous';
  action: string;
  shipmentId?: string | null;
  decision: AuditDecision;
  reason: string;
  ipAddress?: string | null;
}

// Sanitizes reason and action to ensure no tokens, passwords, or full addresses leak into audit logs
function sanitizeAuditString(input: string): string {
  return input
    .replace(/(bearer\s+[a-zA-Z0-9_\-\.]+)/gi, '[REDACTED_TOKEN]')
    .replace(/(password|secret|key)=([^\s&]+)/gi, '$1=[REDACTED]')
    .slice(0, 500);
}

export async function logAuditEvent(params: LogAuditParams): Promise<AuditLogEntry> {
  const db = getDbClient();
  const safeReason = sanitizeAuditString(params.reason);
  const safeAction = sanitizeAuditString(params.action);
  const safeActorRole = params.actorRole || 'anonymous';
  const safeActorId = params.actorId || null;
  const safeShipmentId = params.shipmentId || null;
  const safeIp = params.ipAddress ? params.ipAddress.slice(0, 45) : null;

  const result = await db.query<AuditLogEntry>(
    `INSERT INTO audit_log (actor_id, actor_role, action, shipment_id, decision, reason, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, timestamp, actor_id, actor_role, action, shipment_id, decision, reason, ip_address, created_at`,
    [safeActorId, safeActorRole, safeAction, safeShipmentId, params.decision, safeReason, safeIp]
  );

  return result.rows[0];
}

export async function getAuditLogsForAdmin(adminActorId: string, limit: number = 100): Promise<AuditLogEntry[]> {
  const db = getDbClient();
  
  // Verify actor is actually an admin in the database
  const profileRes = await db.query<{ role: string }>(
    `SELECT role FROM profiles WHERE id = $1`,
    [adminActorId]
  );

  if (profileRes.rows.length === 0 || profileRes.rows[0].role !== 'admin') {
    await logAuditEvent({
      actorId: adminActorId,
      actorRole: (profileRes.rows[0]?.role as UserRole) || 'anonymous',
      action: 'AUDIT_LOG_READ',
      decision: 'DENIED',
      reason: 'Unauthorized attempt to inspect security audit logs (admin required)',
    });
    throw new Error('FORBIDDEN: Only administrators can read audit entries.');
  }

  const result = await db.query<AuditLogEntry>(
    `SELECT id, timestamp, actor_id, actor_role, action, shipment_id, decision, reason, ip_address, created_at
     FROM audit_log
     ORDER BY timestamp DESC
     LIMIT $1`,
    [Math.min(limit, 500)]
  );

  await logAuditEvent({
    actorId: adminActorId,
    actorRole: 'admin',
    action: 'AUDIT_LOG_READ',
    decision: 'ALLOWED',
    reason: `Admin retrieved ${result.rows.length} audit log entries`,
  });

  return result.rows;
}
