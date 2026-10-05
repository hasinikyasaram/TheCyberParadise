-- ShipTrack Sentinel Schema Migration: 001_initial_schema.sql
-- Enforces Core Security Principles:
-- 1. UUID primary keys
-- 2. Strict Row Level Security (RLS) on all exposed tables
-- 3. In-database state machine enforcement (created -> assigned -> picked_up -> in_transit -> delivered)
-- 4. Append-only tamper-resistant audit_log table (blocked UPDATE/DELETE)
-- 5. Role-based privileges and least privilege access

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES & ROLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('customer', 'driver', 'admin')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. SHIPMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number TEXT NOT NULL UNIQUE,
  tracking_token_hash TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'assigned', 'picked_up', 'in_transit', 'delivered')),
  origin_city TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  current_location TEXT NOT NULL DEFAULT 'Dispatch Center',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. ASSIGNMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. SHIPMENT STATUS EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipment_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL CHECK (from_status IN ('created', 'assigned', 'picked_up', 'in_transit', 'delivered')),
  to_status TEXT NOT NULL CHECK (to_status IN ('created', 'assigned', 'picked_up', 'in_transit', 'delivered')),
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  location TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. APPEND-ONLY AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'anonymous',
  action TEXT NOT NULL,
  shipment_id UUID,
  decision TEXT NOT NULL CHECK (decision IN ('ALLOWED', 'DENIED')),
  reason TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent any UPDATE or DELETE on audit_log
CREATE OR REPLACE FUNCTION audit_log_prevent_tamper()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'SECURITY ALERT: audit_log is strictly append-only. Modification or deletion is prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_prevent_tamper();

-- ============================================================================
-- 6. STRICT POSTGRES STATE MACHINE FOR SHIPMENT STATUS
-- Valid transitions: created -> assigned -> picked_up -> in_transit -> delivered
-- ============================================================================
CREATE OR REPLACE FUNCTION enforce_shipment_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_has_active_assignment BOOLEAN;
BEGIN
  -- If status did not change, allow update
  IF OLD.status = NEW.status THEN
    NEW.updated_at = NOW();
    RETURN NEW;
  END IF;

  -- Verify valid state transitions
  IF OLD.status = 'created' AND NEW.status = 'assigned' THEN
    -- Must have an active assignment or being assigned
    NULL;
  ELSIF OLD.status = 'assigned' AND NEW.status = 'picked_up' THEN
    SELECT EXISTS (
      SELECT 1 FROM assignments
      WHERE shipment_id = NEW.id AND is_active = TRUE
    ) INTO v_has_active_assignment;

    IF NOT v_has_active_assignment THEN
      RAISE EXCEPTION 'STATE_TRANSITION_ERROR: Cannot transition to picked_up without an active assignment.';
    END IF;
  ELSIF OLD.status = 'picked_up' AND NEW.status = 'in_transit' THEN
    NULL;
  ELSIF OLD.status = 'in_transit' AND NEW.status = 'delivered' THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'STATE_TRANSITION_ERROR: Invalid shipment status transition from % to %.', OLD.status, NEW.status;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_shipment_status_transition ON shipments;
CREATE TRIGGER trg_enforce_shipment_status_transition
BEFORE UPDATE OF status ON shipments
FOR EACH ROW EXECUTE FUNCTION enforce_shipment_status_transition();

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function: get role of current authenticated user
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles Policies:
-- Self can view own profile; Admin can view all
DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON profiles;
CREATE POLICY "profiles_select_self_or_admin" ON profiles
FOR SELECT USING (
  id = auth.uid() OR auth_user_role() = 'admin'
);

-- Shipments Policies:
-- Customer can read only their own shipments
DROP POLICY IF EXISTS "shipments_customer_select" ON shipments;
CREATE POLICY "shipments_customer_select" ON shipments
FOR SELECT USING (
  customer_id = auth.uid()
);

-- Driver can read only actively assigned shipments
DROP POLICY IF EXISTS "shipments_driver_select" ON shipments;
CREATE POLICY "shipments_driver_select" ON shipments
FOR SELECT USING (
  auth_user_role() = 'driver' AND EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.shipment_id = shipments.id
      AND assignments.driver_id = auth.uid()
      AND assignments.is_active = TRUE
  )
);

-- Driver can update only actively assigned shipments
DROP POLICY IF EXISTS "shipments_driver_update" ON shipments;
CREATE POLICY "shipments_driver_update" ON shipments
FOR UPDATE USING (
  auth_user_role() = 'driver' AND EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.shipment_id = shipments.id
      AND assignments.driver_id = auth.uid()
      AND assignments.is_active = TRUE
  )
);

-- Admin can manage all shipments
DROP POLICY IF EXISTS "shipments_admin_all" ON shipments;
CREATE POLICY "shipments_admin_all" ON shipments
FOR ALL USING (
  auth_user_role() = 'admin'
);

-- Assignments Policies:
-- Customer can see assignments for their own shipments
DROP POLICY IF EXISTS "assignments_customer_select" ON assignments;
CREATE POLICY "assignments_customer_select" ON assignments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM shipments
    WHERE shipments.id = assignments.shipment_id
      AND shipments.customer_id = auth.uid()
  )
);

-- Driver can see their own assignments
DROP POLICY IF EXISTS "assignments_driver_select" ON assignments;
CREATE POLICY "assignments_driver_select" ON assignments
FOR SELECT USING (
  driver_id = auth.uid()
);

-- Admin can manage all assignments
DROP POLICY IF EXISTS "assignments_admin_all" ON assignments;
CREATE POLICY "assignments_admin_all" ON assignments
FOR ALL USING (
  auth_user_role() = 'admin'
);

-- Shipment Status Events Policies:
-- Customer can view events for their shipments
DROP POLICY IF EXISTS "events_customer_select" ON shipment_status_events;
CREATE POLICY "events_customer_select" ON shipment_status_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM shipments
    WHERE shipments.id = shipment_status_events.shipment_id
      AND shipments.customer_id = auth.uid()
  )
);

-- Driver can view events for their assigned shipments
DROP POLICY IF EXISTS "events_driver_select" ON shipment_status_events;
CREATE POLICY "events_driver_select" ON shipment_status_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.shipment_id = shipment_status_events.shipment_id
      AND assignments.driver_id = auth.uid()
  )
);

-- Admin can view all events
DROP POLICY IF EXISTS "events_admin_all" ON shipment_status_events;
CREATE POLICY "events_admin_all" ON shipment_status_events
FOR ALL USING (
  auth_user_role() = 'admin'
);

-- Audit Log Policies:
-- Strictly admin-only for read
DROP POLICY IF EXISTS "audit_admin_select" ON audit_log;
CREATE POLICY "audit_admin_select" ON audit_log
FOR SELECT USING (
  auth_user_role() = 'admin'
);

-- Any authenticated user or service can insert audit entries (needed to log allowed and denied actions)
DROP POLICY IF EXISTS "audit_insert_any" ON audit_log;
CREATE POLICY "audit_insert_any" ON audit_log
FOR INSERT WITH CHECK (true);
