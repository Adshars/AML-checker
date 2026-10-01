import {
  applyAttemptsExhausted,
  applyExpiry,
  applyProviderResult,
  applyReview,
  applyScreeningResult,
  applyStart,
  attemptsLeft,
  canReview,
  canStart,
  canUploadDocument,
  canUploadSelfie,
  getPublicStep,
  isFinalStatus,
  isLinkExpired,
  isSessionExpired,
  VERIFICATION_STATUSES
} from '../src/domain/entities/Verification.js';
import { InvalidStateError, ValidationError } from '../src/shared/errors/index.js';
import { makeVerification, NOW } from './helpers/verificationFactory.js';

const ms = (offset: number) => new Date(NOW.getTime() + offset);
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const inProgress = (overrides = {}) => makeVerification({
  status: 'IN_PROGRESS',
  startedAt: NOW,
  consentAt: NOW,
  sessionExpiresAt: ms(60 * MINUTE),
  tokenEncrypted: null,
  ...overrides
});

const screening = { hitsCount: 0, isSanctioned: false, isPep: false, topMatch: null, auditLogId: 'audit-1' };

describe('New verification', () => {
  test('starts PENDING with a 72 h link and nothing collected', () => {
    const v = makeVerification();

    expect(v.status).toBe('PENDING');
    expect(v.linkExpiresAt).toEqual(ms(72 * HOUR));
    expect(v.documentAttempts).toBe(0);
    expect(v.providerVerificationIds).toEqual([]);
    expect(v.screeningStatus).toBe('NOT_APPLICABLE');
  });

  test('FULL_AML starts with a pending screening', () => {
    const v = makeVerification({ identityMode: 'FULL_AML', screeningStatus: 'PENDING' });
    expect(v.screeningStatus).toBe('PENDING');
  });

  test('final statuses', () => {
    const finals = VERIFICATION_STATUSES.filter(isFinalStatus);
    expect(finals).toEqual(['VERIFIED', 'REJECTED', 'EXPIRED']);
  });
});

describe('Link and session expiry', () => {
  test('link is valid until linkExpiresAt (exclusive)', () => {
    const v = makeVerification();
    expect(isLinkExpired(v, ms(72 * HOUR - 1))).toBe(false);
    expect(isLinkExpired(v, ms(72 * HOUR))).toBe(true);
  });

  test('link expiry applies only to PENDING', () => {
    const v = inProgress();
    expect(isLinkExpired(v, ms(100 * HOUR))).toBe(false);
  });

  test('session is valid until sessionExpiresAt (exclusive)', () => {
    const v = inProgress();
    expect(isSessionExpired(v, ms(60 * MINUTE - 1))).toBe(false);
    expect(isSessionExpired(v, ms(60 * MINUTE))).toBe(true);
  });

  test('session expiry applies only to IN_PROGRESS', () => {
    const v = inProgress({ status: 'PROCESSING' });
    expect(isSessionExpired(v, ms(2 * HOUR))).toBe(false);
  });

  test('applyExpiry: PENDING after the link TTL -> EXPIRED', () => {
    expect(applyExpiry(makeVerification(), ms(72 * HOUR))).toEqual({ status: 'EXPIRED', tokenEncrypted: null });
    expect(applyExpiry(makeVerification(), ms(72 * HOUR - 1))).toBeNull();
  });

  test('applyExpiry: IN_PROGRESS after the session TTL -> EXPIRED', () => {
    expect(applyExpiry(inProgress(), ms(60 * MINUTE))).toEqual({ status: 'EXPIRED', tokenEncrypted: null });
  });

  test('applyExpiry: other statuses never expire', () => {
    for (const status of ['PROCESSING', 'VERIFIED', 'REJECTED', 'MANUAL_REVIEW', 'EXPIRED'] as const) {
      expect(applyExpiry(inProgress({ status }), ms(1000 * HOUR))).toBeNull();
    }
  });
});

describe('Step guards', () => {
  test('canStart only for a valid PENDING link', () => {
    expect(canStart(makeVerification(), NOW)).toBe(true);
    expect(canStart(makeVerification(), ms(72 * HOUR))).toBe(false);
    expect(canStart(inProgress(), NOW)).toBe(false);
  });

  test('document upload only in progress, before an accepted document', () => {
    expect(canUploadDocument(inProgress(), NOW)).toBe(true);
    expect(canUploadDocument(inProgress({ documentImagePath: 'doc' }), NOW)).toBe(false);
    expect(canUploadDocument(inProgress(), ms(60 * MINUTE))).toBe(false);
    expect(canUploadDocument(makeVerification(), NOW)).toBe(false);
  });

  test('selfie upload only after an accepted document', () => {
    expect(canUploadSelfie(inProgress(), NOW)).toBe(false);
    expect(canUploadSelfie(inProgress({ documentImagePath: 'doc' }), NOW)).toBe(true);
    expect(canUploadSelfie(inProgress({ documentImagePath: 'doc' }), ms(60 * MINUTE))).toBe(false);
  });

  test('review only in MANUAL_REVIEW', () => {
    for (const status of VERIFICATION_STATUSES) {
      expect(canReview(makeVerification({ status }))).toBe(status === 'MANUAL_REVIEW');
    }
  });
});

describe('applyStart', () => {
  test('PENDING -> IN_PROGRESS with consent, a 60 min session and the raw token dropped', () => {
    const patch = applyStart(makeVerification(), { ip: '10.0.0.1', now: NOW, sessionTtlMinutes: 60 });

    expect(patch).toEqual({
      status: 'IN_PROGRESS',
      consentAt: NOW,
      consentIp: '10.0.0.1',
      startedAt: NOW,
      sessionExpiresAt: ms(60 * MINUTE),
      tokenEncrypted: null
    });
  });

  test('expired link or already started -> InvalidStateError', () => {
    expect(() => applyStart(makeVerification(), { ip: null, now: ms(72 * HOUR), sessionTtlMinutes: 60 }))
      .toThrow(InvalidStateError);
    expect(() => applyStart(inProgress(), { ip: null, now: NOW, sessionTtlMinutes: 60 }))
      .toThrow(InvalidStateError);
  });
});

describe('applyProviderResult', () => {
  const processing = (identityMode: 'IDENTITY' | 'FULL_AML') => makeVerification({ status: 'PROCESSING', identityMode });

  test.each([
    ['VERIFIED', null],
    ['REJECTED', 'FACE_MISMATCH'],
    ['MANUAL_REVIEW', 'LOW_CONFIDENCE']
  ] as const)('IDENTITY: provider %s is the final status', (outcome, reason) => {
    const patch = applyProviderResult(processing('IDENTITY'), { outcome, reason }, NOW);

    expect(patch).toEqual({
      providerOutcome: outcome,
      status: outcome,
      decisionSource: 'AUTO',
      decisionReason: reason,
      completedAt: NOW
    });
  });

  test('FULL_AML: stays PROCESSING until screening', () => {
    const patch = applyProviderResult(processing('FULL_AML'), { outcome: 'VERIFIED', reason: null }, NOW);

    expect(patch).toEqual({ providerOutcome: 'VERIFIED', decisionReason: null, screeningStatus: 'PENDING' });
    expect(patch.status).toBeUndefined();
  });

  test('only while PROCESSING', () => {
    expect(() => applyProviderResult(inProgress(), { outcome: 'VERIFIED', reason: null }, NOW)).toThrow(InvalidStateError);
  });
});

describe('applyScreeningResult', () => {
  const screened = (providerOutcome: 'VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW', decisionReason: string | null = null) =>
    makeVerification({ status: 'PROCESSING', identityMode: 'FULL_AML', providerOutcome, decisionReason, screeningStatus: 'PENDING' });

  test('CLEAR keeps the provider outcome', () => {
    const patch = applyScreeningResult(screened('VERIFIED'), screening, NOW);

    expect(patch).toMatchObject({
      status: 'VERIFIED',
      screeningStatus: 'CLEAR',
      screeningAttempts: 1,
      screenedAt: NOW,
      auditLogId: 'audit-1',
      decisionSource: 'AUTO',
      completedAt: NOW
    });
  });

  test('CLEAR keeps the provider manual review reason', () => {
    const patch = applyScreeningResult(screened('MANUAL_REVIEW', 'LOW_CONFIDENCE'), screening, NOW);
    expect(patch).toMatchObject({ status: 'MANUAL_REVIEW', decisionReason: 'LOW_CONFIDENCE' });
  });

  test('HIT on a verified identity -> MANUAL_REVIEW with SCREENING_HIT', () => {
    const hit = { hitsCount: 2, isSanctioned: true, isPep: false, topMatch: { name: 'X', score: 0.97 }, auditLogId: 'audit-2' };
    const patch = applyScreeningResult(screened('VERIFIED'), hit, NOW);

    expect(patch).toMatchObject({
      status: 'MANUAL_REVIEW',
      decisionReason: 'SCREENING_HIT',
      screeningStatus: 'HIT',
      screeningHitsCount: 2,
      screeningIsSanctioned: true,
      screeningTopMatch: { name: 'X', score: 0.97 }
    });
  });

  test('HIT on a provider manual review -> SCREENING_HIT reason', () => {
    const patch = applyScreeningResult(screened('MANUAL_REVIEW', 'LOW_CONFIDENCE'), { ...screening, hitsCount: 1 }, NOW);
    expect(patch).toMatchObject({ status: 'MANUAL_REVIEW', decisionReason: 'SCREENING_HIT' });
  });

  test('HIT on a rejected identity stays REJECTED, screening is still recorded', () => {
    const patch = applyScreeningResult(screened('REJECTED', 'FACE_MISMATCH'), { ...screening, hitsCount: 1, isPep: true }, NOW);

    expect(patch).toMatchObject({
      status: 'REJECTED',
      decisionReason: 'FACE_MISMATCH',
      screeningStatus: 'HIT',
      screeningIsPep: true,
      auditLogId: 'audit-1'
    });
  });

  test('not applicable to IDENTITY or before the provider result', () => {
    expect(() => applyScreeningResult(makeVerification({ status: 'PROCESSING', providerOutcome: 'VERIFIED' }), screening, NOW))
      .toThrow(InvalidStateError);
    expect(() => applyScreeningResult(makeVerification({ status: 'PROCESSING', identityMode: 'FULL_AML' }), screening, NOW))
      .toThrow(InvalidStateError);
  });
});

describe('applyReview', () => {
  const inReview = () => makeVerification({ status: 'MANUAL_REVIEW', decisionSource: 'AUTO', decisionReason: 'SCREENING_HIT' });
  const reviewer = { reviewerId: 'user-1', reviewerName: 'Anna Nowak' };

  test('APPROVE without a comment -> VERIFIED, manual decision recorded', () => {
    const patch = applyReview(inReview(), { decision: 'APPROVE', ...reviewer }, NOW);

    expect(patch).toEqual({
      status: 'VERIFIED',
      decisionSource: 'MANUAL',
      reviewedById: 'user-1',
      reviewedByName: 'Anna Nowak',
      reviewedAt: NOW,
      reviewComment: null
    });
  });

  test('REJECT with a comment -> REJECTED', () => {
    const patch = applyReview(inReview(), { decision: 'REJECT', comment: '  Document forged  ', ...reviewer }, NOW);
    expect(patch).toMatchObject({ status: 'REJECTED', reviewComment: 'Document forged' });
  });

  test.each([undefined, '', '  ', 'ab'])('REJECT with comment %p -> ValidationError', (comment) => {
    expect(() => applyReview(inReview(), { decision: 'REJECT', comment, ...reviewer }, NOW)).toThrow(ValidationError);
  });

  test('comment longer than 1000 characters -> ValidationError', () => {
    expect(() => applyReview(inReview(), { decision: 'APPROVE', comment: 'x'.repeat(1001), ...reviewer }, NOW))
      .toThrow(ValidationError);
  });

  test('outside MANUAL_REVIEW -> InvalidStateError', () => {
    expect(() => applyReview(makeVerification({ status: 'VERIFIED' }), { decision: 'APPROVE', ...reviewer }, NOW))
      .toThrow(InvalidStateError);
  });
});

describe('Customer page helpers', () => {
  test('public step follows status and the accepted document', () => {
    expect(getPublicStep(makeVerification())).toBe('CONSENT');
    expect(getPublicStep(inProgress())).toBe('DOCUMENT');
    expect(getPublicStep(inProgress({ documentImagePath: 'doc' }))).toBe('SELFIE');
    for (const status of ['PROCESSING', 'VERIFIED', 'REJECTED', 'MANUAL_REVIEW', 'EXPIRED'] as const) {
      expect(getPublicStep(makeVerification({ status }))).toBe('DONE');
    }
  });

  test('attempts left never goes below zero', () => {
    expect(attemptsLeft(0, 3)).toBe(3);
    expect(attemptsLeft(3, 3)).toBe(0);
    expect(attemptsLeft(5, 3)).toBe(0);
  });

  test('exhausted attempts -> REJECTED with an automatic decision', () => {
    expect(applyAttemptsExhausted(inProgress(), 'NO_FACE_DETECTED', NOW)).toEqual({
      status: 'REJECTED',
      decisionSource: 'AUTO',
      decisionReason: 'NO_FACE_DETECTED',
      completedAt: NOW
    });
    expect(() => applyAttemptsExhausted(makeVerification(), 'DOCUMENT_UNREADABLE', NOW)).toThrow(InvalidStateError);
  });
});
