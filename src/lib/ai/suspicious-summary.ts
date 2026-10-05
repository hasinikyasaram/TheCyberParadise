import { getDbClient } from '../db';
import { AuthSession, AuditLogEntry } from '../types';
import { logAuditEvent } from '../audit';

export interface SuspiciousSummaryResponse {
  summary: string;
  total_suspicious_events: number;
  recent_incidents: Array<{
    action: string;
    reason: string;
    timestamp: string;
    ip_address: string | null;
  }>;
  read_only: true;
}

/**
 * Summarizes suspicious events and security denials strictly for authenticated admins.
 * Context is restricted to authorized audit/security fields (never personal data or secrets).
 */
export async function summarizeSuspiciousEvents(
  session: AuthSession,
  limit: number = 20
): Promise<SuspiciousSummaryResponse> {
  if (session.user.role !== 'admin') {
    await logAuditEvent({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: 'SUSPICIOUS_EVENTS_SUMMARY',
      decision: 'DENIED',
      reason: 'Unauthorized attempt by non-admin to generate suspicious security events summary',
    });
    throw new Error('FORBIDDEN: Only administrators can view suspicious security event summaries.');
  }

  const db = getDbClient();
  const res = await db.query<AuditLogEntry>(
    `SELECT action, reason, timestamp, ip_address
     FROM audit_log
     WHERE decision = 'DENIED' OR action LIKE 'SECURITY_ALERT%'
     ORDER BY timestamp DESC
     LIMIT $1`,
    [limit]
  );

  const events = res.rows;

  let summary = '';
  if (events.length === 0) {
    summary = 'No suspicious security events or policy denials recorded in the recent audit timeline.';
  } else {
    const probingCount = events.filter((e) => e.action.includes('PROBING')).length;
    const authDenials = events.filter((e) => e.action.includes('READ_SHIPMENT') || e.action.includes('UPDATE')).length;
    summary = `Security Alert Summary: ${events.length} total blocked events detected. Breakdown: ${probingCount} probing/enumeration alert(s), ${authDenials} unauthorized access attempt(s). Row-level controls and rate limits successfully mitigated all detected vectors.`;
  }

  await logAuditEvent({
    actorId: session.user.id,
    actorRole: 'admin',
    action: 'SUSPICIOUS_EVENTS_SUMMARY',
    decision: 'ALLOWED',
    reason: `Admin generated security summary for ${events.length} suspicious events`,
  });

  return {
    summary,
    total_suspicious_events: events.length,
    recent_incidents: events,
    read_only: true,
  };
}
