export const IDENTITY_MODES = ['NONE', 'IDENTITY', 'FULL_AML'] as const;

export type IdentityMode = typeof IDENTITY_MODES[number];

/**
 * Service package enabled for an organization
 */
export interface OrganizationServices {
  sanctions: boolean;
  identityMode: IdentityMode;
}

export const DEFAULT_ORGANIZATION_SERVICES: Readonly<OrganizationServices> = Object.freeze({
  sanctions: true,
  identityMode: 'NONE'
});

const isIdentityMode = (value: unknown): value is IdentityMode =>
  typeof value === 'string' && (IDENTITY_MODES as readonly string[]).includes(value);

/**
 * Fill missing or invalid fields with defaults
 * (legacy documents, old tokens, partial input)
 */
export const normalizeOrganizationServices = (
  input?: Partial<OrganizationServices> | null
): OrganizationServices => ({
  sanctions: typeof input?.sanctions === 'boolean' ? input.sanctions : DEFAULT_ORGANIZATION_SERVICES.sanctions,
  identityMode: isIdentityMode(input?.identityMode) ? input.identityMode : DEFAULT_ORGANIZATION_SERVICES.identityMode
});

/**
 * An organization must have at least one service enabled
 */
export const hasAnyService = (services: OrganizationServices): boolean =>
  services.sanctions || services.identityMode !== 'NONE';
