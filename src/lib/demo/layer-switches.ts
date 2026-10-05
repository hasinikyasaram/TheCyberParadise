import { UserRole } from '../types';

export interface LayerSwitchesConfig {
  bypassServerAuthCheck: boolean;
  bypassAppStateMachineCheck: boolean;
  bypassAntiEnumeration: boolean;
}

const currentSwitches: LayerSwitchesConfig = {
  bypassServerAuthCheck: false,
  bypassAppStateMachineCheck: false,
  bypassAntiEnumeration: false,
};

/**
 * Validates whether demo layer bypass is allowed.
 * Security Rules:
 * 1. Must be in DEMO_MODE (process.env.DEMO_MODE === 'true' or local non-production).
 * 2. Actor must be an authenticated 'admin'.
 * 3. Fails closed in production.
 * 4. Never weakens or disables Postgres database RLS or database triggers.
 */
export function isDemoModeEnabled(): boolean {
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
    return false;
  }
  return process.env.DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
}

export function getLayerSwitches(actorRole?: UserRole): LayerSwitchesConfig {
  if (!isDemoModeEnabled() || actorRole !== 'admin') {
    // Fail closed: all switches off
    return {
      bypassServerAuthCheck: false,
      bypassAppStateMachineCheck: false,
      bypassAntiEnumeration: false,
    };
  }
  return { ...currentSwitches };
}

export function updateLayerSwitches(
  updates: Partial<LayerSwitchesConfig>,
  actorRole: UserRole
): LayerSwitchesConfig {
  if (!isDemoModeEnabled()) {
    throw new Error('SECURITY_ERROR: Demo layer switches are disabled outside demo mode.');
  }

  if (actorRole !== 'admin') {
    throw new Error('SECURITY_ERROR: Only administrators can configure demo layer switches.');
  }

  if (updates.bypassServerAuthCheck !== undefined) {
    currentSwitches.bypassServerAuthCheck = updates.bypassServerAuthCheck;
  }
  if (updates.bypassAppStateMachineCheck !== undefined) {
    currentSwitches.bypassAppStateMachineCheck = updates.bypassAppStateMachineCheck;
  }
  if (updates.bypassAntiEnumeration !== undefined) {
    currentSwitches.bypassAntiEnumeration = updates.bypassAntiEnumeration;
  }

  return { ...currentSwitches };
}
