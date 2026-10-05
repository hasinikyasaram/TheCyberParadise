import { AuthSession, Shipment, UserRole } from './types';

/**
 * Enforces field-level address privacy at the server and database layer.
 * Rules:
 * - Customer can view full address of their own shipments.
 * - Admin can view full address.
 * - Driver can view full delivery address ONLY while the shipment is actively assigned
 *   AND the shipment is active (assigned, picked_up, in_transit).
 * - As soon as the shipment is 'delivered' or if the assignment is inactive, the address
 *   is strictly redacted.
 * - All unauthorized callers have address redacted.
 */
export function applyFieldLevelAddressPrivacy(
  shipment: Shipment,
  session: AuthSession,
  isActiveDriverAssignment: boolean = false
): Shipment {
  const { role, id: userId } = session.user;

  // 1. Admin always has operational access
  if (role === 'admin') {
    return shipment;
  }

  // 2. Customer can view their own address
  if (role === 'customer' && shipment.customer_id === userId) {
    return shipment;
  }

  // 3. Driver: Full address permitted ONLY during active transit
  if (role === 'driver') {
    const isDeliveryActive = ['assigned', 'picked_up', 'in_transit'].includes(shipment.status);
    if (isActiveDriverAssignment && isDeliveryActive) {
      return shipment;
    }

    // Access terminated on delivery or reassignment
    const redactionNotice =
      shipment.status === 'delivered'
        ? '[REDACTED — Address access terminated upon delivery]'
        : '[REDACTED — Driver is not actively assigned]';

    return {
      ...shipment,
      delivery_address: redactionNotice,
    };
  }

  // 4. Default: Full redaction
  return {
    ...shipment,
    delivery_address: '[REDACTED]',
  };
}
