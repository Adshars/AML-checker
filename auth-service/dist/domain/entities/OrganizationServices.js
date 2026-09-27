export const IDENTITY_MODES = ['NONE', 'IDENTITY', 'FULL_AML'];
export const DEFAULT_ORGANIZATION_SERVICES = Object.freeze({
    sanctions: true,
    identityMode: 'NONE'
});
const isIdentityMode = (value) => typeof value === 'string' && IDENTITY_MODES.includes(value);
/**
 * Fill missing or invalid fields with defaults
 * (legacy documents, old tokens, partial input)
 */
export const normalizeOrganizationServices = (input) => ({
    sanctions: typeof input?.sanctions === 'boolean' ? input.sanctions : DEFAULT_ORGANIZATION_SERVICES.sanctions,
    identityMode: isIdentityMode(input?.identityMode) ? input.identityMode : DEFAULT_ORGANIZATION_SERVICES.identityMode
});
/**
 * An organization must have at least one service enabled
 */
export const hasAnyService = (services) => services.sanctions || services.identityMode !== 'NONE';
