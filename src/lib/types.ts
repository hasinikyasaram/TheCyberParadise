export type UserRole = 'customer' | 'driver' | 'admin';

export type ShipmentStatus = 'created' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered';

export const VALID_STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  created: ['assigned'],
  assigned: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered'],
  delivered: [],
};

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  created_at: string;
}

export interface Shipment {
  id: string;
  tracking_number: string;
  tracking_token_hash: string;
  customer_id: string;
  status: ShipmentStatus;
  origin_city: string;
  destination_city: string;
  delivery_address: string;
  current_location: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  shipment_id: string;
  driver_id: string;
  assigned_by: string;
  is_active: boolean;
  assigned_at: string;
}

export interface ShipmentStatusEvent {
  id: string;
  shipment_id: string;
  from_status: ShipmentStatus;
  to_status: ShipmentStatus;
  actor_id: string;
  location: string;
  notes?: string;
  created_at: string;
}

export type AuditDecision = 'ALLOWED' | 'DENIED';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor_id: string | null;
  actor_role: string;
  action: string;
  shipment_id: string | null;
  decision: AuditDecision;
  reason: string;
  ip_address: string | null;
  created_at: string;
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
    role: UserRole;
    full_name: string;
  };
}
