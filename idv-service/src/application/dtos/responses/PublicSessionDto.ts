import { attemptsLeft, getPublicStep, type Verification } from '../../../domain/entities/Verification.js';

/**
 * What the customer page sees — never the verification result or personal data
 */
export const toPublicSession = (v: Verification, limits: { maxDocumentAttempts: number; maxSelfieAttempts: number }) => ({
  organizationName: v.organizationName,
  status: v.status,
  step: getPublicStep(v),
  linkExpiresAt: v.linkExpiresAt,
  sessionExpiresAt: v.sessionExpiresAt,
  documentAttemptsLeft: attemptsLeft(v.documentAttempts, limits.maxDocumentAttempts),
  selfieAttemptsLeft: attemptsLeft(v.selfieAttempts, limits.maxSelfieAttempts)
});

export type PublicSession = ReturnType<typeof toPublicSession>;
