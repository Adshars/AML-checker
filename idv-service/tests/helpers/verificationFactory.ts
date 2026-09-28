import { buildNewVerification, type Verification } from '../../src/domain/entities/Verification.js';

export const NOW = new Date('2026-10-01T12:00:00.000Z');

/**
 * Verification in any state for domain tests
 */
export const makeVerification = (overrides: Partial<Verification> = {}): Verification => ({
  ...buildNewVerification({
    organizationId: 'org-1',
    organizationName: 'Test Corp',
    identityMode: 'IDENTITY',
    isDemo: false,
    createdByType: 'API',
    createdByUserId: null,
    createdByName: null,
    externalRef: 'CUST-1',
    customerName: 'Jan Testowy',
    redirectUrl: null,
    tokenHash: 'a'.repeat(64),
    tokenEncrypted: 'encrypted',
    provider: 'fake',
    now: NOW,
    linkTtlHours: 72
  }),
  id: '11111111-1111-4111-8111-111111111111',
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides
});
