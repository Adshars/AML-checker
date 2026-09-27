// Local copy of the auth-service contract (services do not share code)
export const IDENTITY_MODES = ['NONE', 'IDENTITY', 'FULL_AML'];
export const DEFAULT_ORGANIZATION_SERVICES = Object.freeze({
    sanctions: true,
    identityMode: 'NONE'
});
const isIdentityMode = (value) => typeof value === 'string' && IDENTITY_MODES.includes(value);
/**
 * Old tokens and API key responses without services fall back to defaults
 */
export const normalizeOrganizationServices = (input) => ({
    sanctions: typeof input?.sanctions === 'boolean' ? input.sanctions : DEFAULT_ORGANIZATION_SERVICES.sanctions,
    identityMode: isIdentityMode(input?.identityMode) ? input.identityMode : DEFAULT_ORGANIZATION_SERVICES.identityMode
});
