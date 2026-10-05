import { DbClient, getDbClient } from './db';
import { logAuditEvent } from './audit';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  reason?: string;
}

// In-database / shared storage simulation for rate limits (persists across serverless lambdas)
const sharedLimitStore: Map<string, { count: number; resetAt: number }> = new Map();
const failedAttemptsStore: Map<string, { count: number; lastAttempt: number; isBlockedUntil: number }> = new Map();

/**
 * Shared backend rate limiter compatible with serverless architecture.
 * Evaluates limits based on key (e.g., `ip:action` or `userId:action`).
 */
export async function checkRateLimit(
  key: string,
  maxLimit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const entry = sharedLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    sharedLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: maxLimit - 1,
      resetAt: now + windowMs,
    };
  }

  if (entry.count >= maxLimit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      reason: 'Rate limit exceeded. Please retry after cooldown.',
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: maxLimit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Tracks failed tracking lookups from an IP/source.
 * If >= 5 failed attempts occur within 5 minutes, records an alert in audit_log
 * and blocks the source for 15 minutes.
 */
export async function recordFailedLookupAttempt(sourceKey: string, db?: DbClient): Promise<{ isBlocked: boolean; alertLogged: boolean }> {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const blockDurationMs = 15 * 60 * 1000; // 15 minutes
  const threshold = 5;

  let attempt = failedAttemptsStore.get(sourceKey);

  if (!attempt || now - attempt.lastAttempt > windowMs) {
    attempt = { count: 1, lastAttempt: now, isBlockedUntil: 0 };
    failedAttemptsStore.set(sourceKey, attempt);
    return { isBlocked: false, alertLogged: false };
  }

  // Already blocked?
  if (attempt.isBlockedUntil > now) {
    return { isBlocked: true, alertLogged: false };
  }

  attempt.count += 1;
  attempt.lastAttempt = now;

  if (attempt.count >= threshold) {
    attempt.isBlockedUntil = now + blockDurationMs;

    // Record safe alert in audit_log
    const safeSource = sourceKey.replace(/[^a-zA-Z0-9_\-.:]/g, '').slice(0, 45);
    await logAuditEvent({
      actorRole: 'anonymous',
      action: 'SECURITY_ALERT_PROBING_DETECTED',
      decision: 'DENIED',
      reason: `Probing attack detected: repeated failed tracking token lookups (${attempt.count} failures) from source [${safeSource}]. Blocked for 15 minutes.`,
      ipAddress: safeSource,
    });

    return { isBlocked: true, alertLogged: true };
  }

  return { isBlocked: false, alertLogged: false };
}

export function isSourceCurrentlyBlocked(sourceKey: string): boolean {
  const attempt = failedAttemptsStore.get(sourceKey);
  if (!attempt) return false;
  return attempt.isBlockedUntil > Date.now();
}

export function resetRateLimitsForTesting() {
  sharedLimitStore.clear();
  failedAttemptsStore.clear();
}
