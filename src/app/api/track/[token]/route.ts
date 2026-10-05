import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDbClient } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { notFoundResponse, badRequestResponse } from '@/lib/errors';
import { PublicTrackingQuerySchema } from '@/lib/validation';
import { checkRateLimit, recordFailedLookupAttempt, isSourceCurrentlyBlocked } from '@/lib/rate-limiter';

interface RouteContext {
  params: {
    token: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const sourceKey = `ip:${ip}`;

  // 1. Check if source is blocked due to detected probing
  if (isSourceCurrentlyBlocked(sourceKey)) {
    return NextResponse.json(
      {
        error: 'TOO_MANY_REQUESTS',
        message: 'Security Notice: Repeated failed lookups detected from this IP. Requests temporarily restricted.',
      },
      { status: 429 }
    );
  }

  // 2. Shared Rate Limiting (10 requests/minute for tracking lookups)
  const rateLimit = await checkRateLimit(`${sourceKey}:tracking`, 10, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: rateLimit.reason,
      },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      }
    );
  }

  // 3. Validate Token Format
  const parsed = PublicTrackingQuerySchema.safeParse(params);
  if (!parsed.success) {
    await recordFailedLookupAttempt(sourceKey);
    return badRequestResponse('Invalid tracking token format');
  }

  const rawToken = parsed.data.token;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // 4. Query Shipment by Token Hash
  const db = getDbClient();
  const res = await db.query(
    `SELECT tracking_number, status, current_location, origin_city, destination_city, updated_at
     FROM shipments
     WHERE tracking_token_hash = $1`,
    [tokenHash]
  );

  // 5. Anti-Enumeration & Probing Countermeasure
  if (res.rows.length === 0) {
    const probeStatus = await recordFailedLookupAttempt(sourceKey);
    await logAuditEvent({
      actorRole: 'anonymous',
      action: 'PUBLIC_TRACKING_LOOKUP',
      decision: 'DENIED',
      reason: `Invalid tracking token probe from IP [${ip}]${probeStatus.isBlocked ? ' (Source now blocked)' : ''}`,
      ipAddress: ip,
    });

    return notFoundResponse('Tracking record not found');
  }

  const row = res.rows[0];

  // 6. Return strictly coarse, privacy-preserving tracking details
  // NEVER return customer_id, customer name, delivery address, phone, or internal notes
  await logAuditEvent({
    actorRole: 'anonymous',
    action: 'PUBLIC_TRACKING_LOOKUP',
    decision: 'ALLOWED',
    reason: `Public tracking lookup for ${row.tracking_number} (coarse location returned)`,
    ipAddress: ip,
  });

  return NextResponse.json({
    tracking_number: row.tracking_number,
    status: row.status,
    current_location: row.current_location,
    origin_city: row.origin_city,
    destination_city: row.destination_city,
    last_updated: row.updated_at,
  });
}
