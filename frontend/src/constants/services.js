// Organization service packages (mirrors auth-service contract)

export const IDENTITY_MODES = ['NONE', 'IDENTITY', 'FULL_AML'];

export const DEFAULT_SERVICES = Object.freeze({ sanctions: true, identityMode: 'NONE' });

export const SANCTIONS_LABEL = 'Sanctions screening';

export const IDENTITY_MODE_LABELS = {
  NONE: 'None',
  IDENTITY: 'Identity verification',
  FULL_AML: 'Full AML (identity + automatic sanctions screening)',
};

// Short labels for badges in tables
export const IDENTITY_MODE_BADGES = {
  IDENTITY: 'Identity',
  FULL_AML: 'Full AML',
};

export const NO_SERVICE_MESSAGE = 'At least one service must be enabled';

export const PROPAGATION_NOTICE =
  'Changes apply to signed-in users within 15 minutes and to API clients within 1 minute.';

export const normalizeServices = (services) => ({
  sanctions: typeof services?.sanctions === 'boolean' ? services.sanctions : DEFAULT_SERVICES.sanctions,
  identityMode: IDENTITY_MODES.includes(services?.identityMode) ? services.identityMode : DEFAULT_SERVICES.identityMode,
});

export const hasAnyService = (services) => Boolean(services?.sanctions) || (services?.identityMode ?? 'NONE') !== 'NONE';

/**
 * @param {Object} services - normalized services
 * @param {'sanctions'|'identity'} service
 */
export const isServiceEnabled = (services, service) => {
  if (service === 'sanctions') return Boolean(services?.sanctions);
  if (service === 'identity') return (services?.identityMode ?? 'NONE') !== 'NONE';
  return false;
};
