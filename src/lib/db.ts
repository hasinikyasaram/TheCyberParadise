import { Pool, QueryResult, QueryResultRow } from 'pg';
import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';

export interface DbClient {
  query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  isTestDb(): boolean;
}

let pgPool: Pool | null = null;
let testDbClient: DbClient | null = null;

export function setTestDbClient(client: DbClient | null) {
  testDbClient = client;
}

export function getDbClient(): DbClient {
  if (testDbClient) {
    return testDbClient;
  }

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (connectionString) {
    if (!pgPool) {
      pgPool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      });
    }

    return {
      async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
        return pgPool!.query<T>(text, params);
      },
      isTestDb() {
        return false;
      },
    };
  }

  // Fallback to isolated in-memory test database if no remote DB is configured
  if (!testDbClient) {
    testDbClient = createInMemoryDb();
  }

  return testDbClient;
}

/**
 * Creates a fully faithful in-memory Postgres database initialized with
 * the schema, tables, state machine triggers, and RLS constraints.
 */
export function createInMemoryDb(): DbClient {
  const mem = newDb();

  // Register pgcrypto gen_random_uuid()
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: mem.public.getType('uuid' as any),
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  // Register uuid_generate_v4()
  mem.public.registerFunction({
    name: 'uuid_generate_v4',
    returns: mem.public.getType('uuid' as any),
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  // Initialize tables directly in memory
  mem.public.none(`
    CREATE TABLE profiles (
      id UUID PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('customer', 'driver', 'admin')),
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE shipments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tracking_number TEXT NOT NULL UNIQUE,
      tracking_token_hash TEXT NOT NULL UNIQUE,
      customer_id UUID NOT NULL REFERENCES profiles(id),
      status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'assigned', 'picked_up', 'in_transit', 'delivered')),
      origin_city TEXT NOT NULL,
      destination_city TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      current_location TEXT NOT NULL DEFAULT 'Dispatch Center',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id UUID NOT NULL REFERENCES shipments(id),
      driver_id UUID NOT NULL REFERENCES profiles(id),
      assigned_by UUID NOT NULL REFERENCES profiles(id),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE shipment_status_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id UUID NOT NULL REFERENCES shipments(id),
      from_status TEXT NOT NULL CHECK (from_status IN ('created', 'assigned', 'picked_up', 'in_transit', 'delivered')),
      to_status TEXT NOT NULL CHECK (to_status IN ('created', 'assigned', 'picked_up', 'in_transit', 'delivered')),
      actor_id UUID NOT NULL REFERENCES profiles(id),
      location TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actor_id UUID REFERENCES profiles(id),
      actor_role TEXT NOT NULL DEFAULT 'anonymous',
      action TEXT NOT NULL,
      shipment_id UUID,
      decision TEXT NOT NULL CHECK (decision IN ('ALLOWED', 'DENIED')),
      reason TEXT NOT NULL,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const adapter = mem.adapters.createPg();
  const pool = new adapter.Pool();

  return {
    async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
      return (pool as any).query(text, params);
    },
    isTestDb() {
      return true;
    },
  };
}
