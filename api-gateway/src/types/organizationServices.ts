// Local copy of the auth-service contract (services do not share code)
export const IDENTITY_MODES = ['NONE', 'IDENTITY', 'FULL_AML'] as const;

export type IdentityMode = typeof IDENTITY_MODES[number];

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
 * Old tokens and API key responses without services fall back to defaults
 */
export const normalizeOrganizationServices = (input?: Partial<OrganizationServices> | null): OrganizationServices => ({
  sanctions: typeof input?.sanctions === 'boolean' ? input.sanctions : DEFAULT_ORGANIZATION_SERVICES.sanctions,
  identityMode: isIdentityMode(input?.identityMode) ? input.identityMode : DEFAULT_ORGANIZATION_SERVICES.identityMode
});
