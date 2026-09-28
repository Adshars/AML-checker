import type { Verification } from '../../../domain/entities/Verification.js';

const toChecks = (v: Verification) => {
  const hasData = v.livenessPassed !== null || v.faceMatchPassed !== null || v.documentAuthenticity !== null;
  if (!hasData) return null;
  return {
    liveness: { passed: v.livenessPassed, score: v.livenessScore },
    faceMatch: { passed: v.faceMatchPassed, score: v.faceMatchScore },
    documentAuthenticity: v.documentAuthenticity
  };
};

/**
 * Full verification for the panel and B2B polling.
 * verificationUrl is set only while the link can still be used (PENDING).
 */
export const toVerificationDetails = (v: Verification, verificationUrl: string | null) => ({
  id: v.id,
  externalRef: v.externalRef,
  customerName: v.customerName,
  status: v.status,
  identityMode: v.identityMode,
  isDemo: v.isDemo,
  createdBy: { type: v.createdByType, userId: v.createdByUserId, name: v.createdByName },
  createdAt: v.createdAt,
  linkExpiresAt: v.linkExpiresAt,
  consentAt: v.consentAt,
  startedAt: v.startedAt,
  sessionExpiresAt: v.sessionExpiresAt,
  completedAt: v.completedAt,
  redirectUrl: v.redirectUrl,
  verificationUrl,
  document: v.ocr,
  checks: toChecks(v),
  attempts: { document: v.documentAttempts, selfie: v.selfieAttempts },
  decision: {
    source: v.decisionSource,
    reason: v.decisionReason,
    reviewedBy: v.reviewedById ? { id: v.reviewedById, name: v.reviewedByName } : null,
    reviewedAt: v.reviewedAt,
    comment: v.reviewComment
  },
  screening: {
    status: v.screeningStatus,
    screenedAt: v.screenedAt,
    hitsCount: v.screeningHitsCount,
    isSanctioned: v.screeningIsSanctioned,
    isPep: v.screeningIsPep,
    topMatch: v.screeningTopMatch,
    auditLogId: v.auditLogId,
    attempts: v.screeningAttempts
  },
  images: {
    document: v.documentImagePath !== null,
    selfie: v.selfieImagePath !== null,
    purgedAt: v.imagesPurgedAt
  }
});

export type VerificationDetails = ReturnType<typeof toVerificationDetails>;

/**
 * 201 response for a newly created verification request
 */
export const toCreatedVerification = (v: Verification, verificationUrl: string) => ({
  id: v.id,
  status: v.status,
  identityMode: v.identityMode,
  isDemo: v.isDemo,
  verificationUrl,
  linkExpiresAt: v.linkExpiresAt,
  externalRef: v.externalRef,
  customerName: v.customerName,
  createdAt: v.createdAt
});

export type CreatedVerification = ReturnType<typeof toCreatedVerification>;
