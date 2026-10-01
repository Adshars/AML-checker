import { InvalidStateError, ValidationError } from '../../shared/errors/index.js';

export const VERIFICATION_STATUSES = [
  'PENDING', 'IN_PROGRESS', 'PROCESSING', 'VERIFIED', 'REJECTED', 'MANUAL_REVIEW', 'EXPIRED'
] as const;
export type VerificationStatus = typeof VERIFICATION_STATUSES[number];

export const FINAL_STATUSES: readonly VerificationStatus[] = ['VERIFIED', 'REJECTED', 'EXPIRED'];

export type IdentityMode = 'IDENTITY' | 'FULL_AML';
export type CreatedByType = 'API' | 'USER';
export type DecisionSource = 'AUTO' | 'MANUAL';
export type ScreeningStatus = 'NOT_APPLICABLE' | 'PENDING' | 'CLEAR' | 'HIT' | 'ERROR';
/** Provider verdict already mapped to our statuses by the provider adapter */
export type ProviderOutcome = 'VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';
export type ReviewDecision = 'APPROVE' | 'REJECT';

export interface OcrData {
  fullName: string | null;
  dateOfBirth: string | null;
  documentNumber: string | null;
  expiryDate: string | null;
  nationality: string | null;
  issuingCountry: string | null;
  documentType: string | null;
  ocrConfidence: number | null;
}

export interface ScreeningTopMatch {
  name: string | null;
  score: number | null;
}

export interface Verification {
  id: string;
  organizationId: string;
  organizationName: string | null;
  identityMode: IdentityMode;
  isDemo: boolean;
  createdByType: CreatedByType;
  createdByUserId: string | null;
  createdByName: string | null;
  externalRef: string | null;
  customerName: string | null;
  redirectUrl: string | null;
  tokenHash: string;
  tokenEncrypted: string | null;
  linkExpiresAt: Date;
  consentAt: Date | null;
  consentIp: string | null;
  startedAt: Date | null;
  sessionExpiresAt: Date | null;
  completedAt: Date | null;
  status: VerificationStatus;
  decisionSource: DecisionSource | null;
  decisionReason: string | null;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  reviewComment: string | null;
  provider: string;
  providerVerificationIds: string[];
  providerOutcome: ProviderOutcome | null;
  documentAttempts: number;
  selfieAttempts: number;
  ocr: OcrData | null;
  livenessPassed: boolean | null;
  livenessScore: number | null;
  faceMatchPassed: boolean | null;
  faceMatchScore: number | null;
  documentAuthenticity: Record<string, unknown> | null;
  providerResult: Record<string, unknown> | null;
  documentImagePath: string | null;
  documentImageMime: string | null;
  selfieImagePath: string | null;
  selfieImageMime: string | null;
  imagesPurgedAt: Date | null;
  screeningStatus: ScreeningStatus;
  screeningAttempts: number;
  screenedAt: Date | null;
  screeningHitsCount: number | null;
  screeningIsSanctioned: boolean | null;
  screeningIsPep: boolean | null;
  screeningTopMatch: ScreeningTopMatch | null;
  auditLogId: string | null;
  /** Held while an upload is processed — prevents parallel uploads of the same session */
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type VerificationPatch = Partial<Omit<Verification, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>;

export const REVIEW_COMMENT_MIN = 3;
export const REVIEW_COMMENT_MAX = 1000;

export interface NewVerificationParams {
  organizationId: string;
  organizationName: string | null;
  identityMode: IdentityMode;
  isDemo: boolean;
  createdByType: CreatedByType;
  createdByUserId: string | null;
  createdByName: string | null;
  externalRef: string | null;
  customerName: string | null;
  redirectUrl: string | null;
  tokenHash: string;
  tokenEncrypted: string;
  provider: string;
  now: Date;
  linkTtlHours: number;
}

/**
 * Initial state of a verification request (status PENDING, nothing collected yet)
 */
export const buildNewVerification = ({ now, linkTtlHours, ...params }: NewVerificationParams): Omit<Verification, 'id' | 'createdAt' | 'updatedAt'> => ({
  ...params,
  linkExpiresAt: new Date(now.getTime() + linkTtlHours * 60 * 60 * 1000),
  consentAt: null,
  consentIp: null,
  startedAt: null,
  sessionExpiresAt: null,
  completedAt: null,
  status: 'PENDING',
  decisionSource: null,
  decisionReason: null,
  reviewedById: null,
  reviewedByName: null,
  reviewedAt: null,
  reviewComment: null,
  providerVerificationIds: [],
  providerOutcome: null,
  documentAttempts: 0,
  selfieAttempts: 0,
  ocr: null,
  livenessPassed: null,
  livenessScore: null,
  faceMatchPassed: null,
  faceMatchScore: null,
  documentAuthenticity: null,
  providerResult: null,
  documentImagePath: null,
  documentImageMime: null,
  selfieImagePath: null,
  selfieImageMime: null,
  imagesPurgedAt: null,
  screeningStatus: params.identityMode === 'FULL_AML' ? 'PENDING' : 'NOT_APPLICABLE',
  screeningAttempts: 0,
  screenedAt: null,
  screeningHitsCount: null,
  screeningIsSanctioned: null,
  screeningIsPep: null,
  screeningTopMatch: null,
  auditLogId: null,
  lockedUntil: null
});

// ---------- predicates ----------

export const isFinalStatus = (status: VerificationStatus): boolean => FINAL_STATUSES.includes(status);

/** Link is valid until linkExpiresAt (exclusive) — only while the customer has not started */
export const isLinkExpired = (v: Verification, now: Date): boolean =>
  v.status === 'PENDING' && now.getTime() >= v.linkExpiresAt.getTime();

/** Session is valid until sessionExpiresAt (exclusive) — only while in progress */
export const isSessionExpired = (v: Verification, now: Date): boolean =>
  v.status === 'IN_PROGRESS' && v.sessionExpiresAt !== null && now.getTime() >= v.sessionExpiresAt.getTime();

/** A document is accepted once its image path is recorded (rejected attempts are not recorded) */
export const hasAcceptedDocument = (v: Verification): boolean => v.documentImagePath !== null;

export const canStart = (v: Verification, now: Date): boolean =>
  v.status === 'PENDING' && !isLinkExpired(v, now);

export const canUploadDocument = (v: Verification, now: Date): boolean =>
  v.status === 'IN_PROGRESS' && !isSessionExpired(v, now) && !hasAcceptedDocument(v);

export const canUploadSelfie = (v: Verification, now: Date): boolean =>
  v.status === 'IN_PROGRESS' && !isSessionExpired(v, now) && hasAcceptedDocument(v);

export const canReview = (v: Verification): boolean => v.status === 'MANUAL_REVIEW';

export type PublicStep = 'CONSENT' | 'DOCUMENT' | 'SELFIE' | 'DONE';

/** Step shown on the customer page */
export const getPublicStep = (v: Verification): PublicStep => {
  if (v.status === 'PENDING') return 'CONSENT';
  if (v.status === 'IN_PROGRESS') return hasAcceptedDocument(v) ? 'SELFIE' : 'DOCUMENT';
  return 'DONE';
};

export const attemptsLeft = (used: number, max: number): number => Math.max(0, max - used);

// ---------- transitions (return the fields to update) ----------

/**
 * PENDING → EXPIRED after linkExpiresAt, IN_PROGRESS → EXPIRED after sessionExpiresAt
 */
export const applyExpiry = (v: Verification, now: Date): VerificationPatch | null => {
  if (isLinkExpired(v, now) || isSessionExpired(v, now)) {
    return { status: 'EXPIRED', tokenEncrypted: null };
  }
  return null;
};

/**
 * PENDING → IN_PROGRESS on consent; the raw token is no longer needed for the panel link
 */
export const applyStart = (
  v: Verification,
  { ip, now, sessionTtlMinutes }: { ip: string | null; now: Date; sessionTtlMinutes: number }
): VerificationPatch => {
  if (!canStart(v, now)) {
    throw new InvalidStateError('Verification cannot be started', { status: v.status });
  }
  return {
    status: 'IN_PROGRESS',
    consentAt: now,
    consentIp: ip,
    startedAt: now,
    sessionExpiresAt: new Date(now.getTime() + sessionTtlMinutes * 60 * 1000),
    tokenEncrypted: null
  };
};

/**
 * IN_PROGRESS → REJECTED when the customer used up all document / selfie attempts
 */
export const applyAttemptsExhausted = (
  v: Verification,
  reason: 'DOCUMENT_UNREADABLE' | 'NO_FACE_DETECTED',
  now: Date
): VerificationPatch => {
  if (v.status !== 'IN_PROGRESS') {
    throw new InvalidStateError('Verification is not in progress', { status: v.status });
  }
  return {
    status: 'REJECTED',
    decisionSource: 'AUTO',
    decisionReason: reason,
    completedAt: now
  };
};

/**
 * PROCESSING → final status from the provider (IDENTITY), or → screening (FULL_AML)
 */
export const applyProviderResult = (
  v: Verification,
  { outcome, reason }: { outcome: ProviderOutcome; reason: string | null },
  now: Date
): VerificationPatch => {
  if (v.status !== 'PROCESSING') {
    throw new InvalidStateError('Provider result can only be applied while processing', { status: v.status });
  }

  if (v.identityMode === 'FULL_AML') {
    // Final status is decided after sanctions screening
    return {
      providerOutcome: outcome,
      decisionReason: reason,
      screeningStatus: 'PENDING'
    };
  }

  return {
    providerOutcome: outcome,
    status: outcome,
    decisionSource: 'AUTO',
    decisionReason: reason,
    completedAt: now
  };
};

/**
 * FULL_AML: combine the provider outcome with a successful screening.
 * A hit forces MANUAL_REVIEW (SCREENING_HIT) unless the provider already rejected the verification.
 */
export const applyScreeningResult = (
  v: Verification,
  screening: {
    hitsCount: number;
    isSanctioned: boolean;
    isPep: boolean;
    topMatch: ScreeningTopMatch | null;
    auditLogId: string;
  },
  now: Date
): VerificationPatch => {
  if (v.status !== 'PROCESSING' || v.identityMode !== 'FULL_AML' || v.providerOutcome === null) {
    throw new InvalidStateError('Screening result can only be applied to a processed FULL_AML verification', {
      status: v.status
    });
  }

  const isHit = screening.hitsCount > 0;
  const screeningFields: VerificationPatch = {
    screeningStatus: isHit ? 'HIT' : 'CLEAR',
    screeningAttempts: v.screeningAttempts + 1,
    screenedAt: now,
    screeningHitsCount: screening.hitsCount,
    screeningIsSanctioned: screening.isSanctioned,
    screeningIsPep: screening.isPep,
    screeningTopMatch: screening.topMatch,
    auditLogId: screening.auditLogId
  };

  let status: VerificationStatus = v.providerOutcome;
  let decisionReason = v.decisionReason;
  if (isHit && v.providerOutcome !== 'REJECTED') {
    status = 'MANUAL_REVIEW';
    decisionReason = 'SCREENING_HIT';
  }

  return {
    ...screeningFields,
    status,
    decisionSource: 'AUTO',
    decisionReason,
    completedAt: now
  };
};

/**
 * MANUAL_REVIEW → VERIFIED / REJECTED by a panel user; a comment is required to reject
 */
export const applyReview = (
  v: Verification,
  {
    decision,
    comment,
    reviewerId,
    reviewerName
  }: { decision: ReviewDecision; comment?: string | null; reviewerId: string; reviewerName: string | null },
  now: Date
): VerificationPatch => {
  if (!canReview(v)) {
    throw new InvalidStateError('Only verifications in manual review can be reviewed', { status: v.status });
  }

  const trimmed = comment?.trim() || null;
  if (decision === 'REJECT' && (!trimmed || trimmed.length < REVIEW_COMMENT_MIN)) {
    throw new ValidationError(`A comment of at least ${REVIEW_COMMENT_MIN} characters is required to reject`);
  }
  if (trimmed && trimmed.length > REVIEW_COMMENT_MAX) {
    throw new ValidationError(`Comment must be at most ${REVIEW_COMMENT_MAX} characters`);
  }

  return {
    status: decision === 'APPROVE' ? 'VERIFIED' : 'REJECTED',
    decisionSource: 'MANUAL',
    reviewedById: reviewerId,
    reviewedByName: reviewerName,
    reviewedAt: now,
    reviewComment: trimmed
  };
};
