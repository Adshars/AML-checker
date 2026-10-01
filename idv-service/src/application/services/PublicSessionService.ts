import logger from '../../shared/logger/index.js';
import {
  GoneError,
  InvalidStateError,
  NotFoundError,
  ProviderUnavailableError,
  RejectedImageError
} from '../../shared/errors/index.js';
import {
  applyAttemptsExhausted,
  applyExpiry,
  applyProviderResult,
  applyStart,
  attemptsLeft,
  canUploadDocument,
  canUploadSelfie,
  type Verification,
  type VerificationPatch
} from '../../domain/entities/Verification.js';
import type { IVerificationRepository } from '../../domain/repositories/IVerificationRepository.js';
import type { IIdentityProvider, ImageMime, ProviderResult } from '../../domain/providers/IIdentityProvider.js';
import type { EncryptedFileStorage } from '../../infrastructure/storage/EncryptedFileStorage.js';
import { hashToken } from '../../infrastructure/security/tokens.js';
import { toPublicSession, type PublicSession } from '../dtos/responses/PublicSessionDto.js';
import type { ScreeningService } from './ScreeningService.js';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const RESULT_RETRIES = 3;

export interface PublicSessionOptions {
  sessionTtlMinutes: number;
  maxDocumentAttempts: number;
  maxSelfieAttempts: number;
  /** Upload lock — longer than the slowest provider round trip */
  lockMs?: number;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

export interface UploadImage {
  buffer: Buffer;
  mime: ImageMime;
}

/**
 * Public Session Service
 * The end customer's flow behind the verification link: consent → document → selfie.
 * The customer never learns the verification result.
 */
export class PublicSessionService {
  repository: IVerificationRepository;
  provider: IIdentityProvider;
  storage: EncryptedFileStorage;
  screeningService: ScreeningService;
  options: Required<Omit<PublicSessionOptions, 'now' | 'sleep'>>;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;

  constructor(
    repository: IVerificationRepository,
    provider: IIdentityProvider,
    storage: EncryptedFileStorage,
    screeningService: ScreeningService,
    options: PublicSessionOptions
  ) {
    this.repository = repository;
    this.provider = provider;
    this.storage = storage;
    this.screeningService = screeningService;
    this.options = { lockMs: 5 * 60 * 1000, ...options };
    this.now = options.now ?? (() => new Date());
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  private limits() {
    return { maxDocumentAttempts: this.options.maxDocumentAttempts, maxSelfieAttempts: this.options.maxSelfieAttempts };
  }

  /**
   * Verification behind the token, expired lazily; only PENDING / IN_PROGRESS are usable
   */
  private async loadActive(token: string): Promise<Verification> {
    let verification = TOKEN_PATTERN.test(token) ? await this.repository.findByTokenHash(hashToken(token)) : null;
    if (!verification) {
      throw new NotFoundError('Verification link not found');
    }

    const now = this.now();
    const locked = verification.lockedUntil !== null && verification.lockedUntil.getTime() > now.getTime();
    const expiry = locked ? null : applyExpiry(verification, now);
    if (expiry) {
      verification = await this.repository.update(verification.id, expiry, { status: verification.status })
        ?? await this.repository.findById(verification.id) as Verification;
    }

    if (verification.status === 'PENDING' || verification.status === 'IN_PROGRESS') {
      return verification;
    }
    if (verification.status === 'EXPIRED') {
      throw verification.consentAt
        ? new GoneError('The verification session has expired', 'SESSION_EXPIRED')
        : new GoneError('The verification link has expired', 'LINK_EXPIRED');
    }
    throw new GoneError('The verification has already been completed', 'ALREADY_COMPLETED');
  }

  async getSession(token: string): Promise<PublicSession> {
    return toPublicSession(await this.loadActive(token), this.limits());
  }

  /**
   * Consent → IN_PROGRESS; the session clock (60 min) starts now
   */
  async start(token: string, ip: string | null): Promise<{ step: 'DOCUMENT'; sessionExpiresAt: Date | null }> {
    const verification = await this.loadActive(token);
    if (verification.status !== 'PENDING') {
      throw new InvalidStateError('Verification has already been started');
    }

    const patch = applyStart(verification, { ip, now: this.now(), sessionTtlMinutes: this.options.sessionTtlMinutes });
    const updated = await this.repository.update(verification.id, patch, { status: 'PENDING' });
    if (!updated) {
      throw new InvalidStateError('Verification has already been started');
    }

    logger.info('Verification started', { verificationId: updated.id, organizationId: updated.organizationId });
    return { step: 'DOCUMENT', sessionExpiresAt: updated.sessionExpiresAt };
  }

  /**
   * Run an upload under the per-verification lock (double clicks / parallel tabs get 409)
   */
  private async withLock<T>(verification: Verification, work: (locked: Verification) => Promise<T>): Promise<T> {
    const now = this.now();
    const locked = await this.repository.acquireLock(verification.id, now, new Date(now.getTime() + this.options.lockMs));
    if (!locked) {
      throw new InvalidStateError('Another upload is already being processed');
    }
    try {
      return await work(locked);
    } finally {
      await this.repository.update(verification.id, { lockedUntil: null });
    }
  }

  private async openProviderSession(verification: Verification): Promise<string> {
    const { providerVerificationId } = await this.provider.initialize({
      verificationId: verification.id,
      sessionNumber: verification.providerVerificationIds.length + 1,
      clientIp: verification.consentIp,
      customerName: verification.customerName
    });
    return providerVerificationId;
  }

  /**
   * Document attempt: encrypted copy → new provider session → OCR
   */
  async uploadDocument(token: string, image: UploadImage): Promise<{ step: 'SELFIE' }> {
    const verification = await this.loadActive(token);
    if (!canUploadDocument(verification, this.now())) {
      throw new InvalidStateError('A document cannot be uploaded at this step');
    }

    return this.withLock(verification, async (v) => {
      if (!canUploadDocument(v, this.now())) {
        throw new InvalidStateError('A document cannot be uploaded at this step');
      }

      const attempt = v.documentAttempts + 1;
      // Rejected attempts are kept too (useful in review) and purged with the rest
      const storedPath = await this.storage.save(v.organizationId, v.id, `document-${attempt}`, image.buffer);
      const providerVerificationId = await this.openProviderSession(v);
      const providerVerificationIds = [...v.providerVerificationIds, providerVerificationId];
      const outcome = await this.provider.submitDocument({ providerVerificationId, file: image.buffer, mime: image.mime, attempt });

      if (outcome.accepted) {
        await this.repository.update(v.id, {
          documentAttempts: attempt,
          providerVerificationIds,
          ocr: outcome.ocr,
          documentAuthenticity: outcome.authenticity,
          documentImagePath: storedPath,
          documentImageMime: image.mime
        }, { status: 'IN_PROGRESS' });
        logger.info('Document accepted', { verificationId: v.id, attempt });
        return { step: 'SELFIE' as const };
      }

      const left = attemptsLeft(attempt, this.options.maxDocumentAttempts);
      const patch: VerificationPatch = { documentAttempts: attempt, providerVerificationIds };
      if (left === 0) {
        Object.assign(patch, applyAttemptsExhausted(v, 'DOCUMENT_UNREADABLE', this.now()));
      }
      await this.repository.update(v.id, patch, { status: 'IN_PROGRESS' });
      logger.info('Document rejected', { verificationId: v.id, attempt, reason: outcome.reason, attemptsLeft: left });
      throw new RejectedImageError('DOCUMENT_REJECTED', left, outcome.reason);
    });
  }

  /**
   * A rejected selfie ends the provider session — reopen it with the accepted document
   */
  private async reopenProviderSession(v: Verification): Promise<string> {
    const document = await this.storage.read(v.documentImagePath as string);
    const providerVerificationId = await this.openProviderSession(v);
    const outcome = await this.provider.submitDocument({
      providerVerificationId,
      file: document,
      mime: v.documentImageMime as ImageMime,
      attempt: v.documentAttempts
    });
    if (!outcome.accepted) {
      logger.error('Accepted document was rejected when reopening the provider session', { verificationId: v.id });
      throw new ProviderUnavailableError();
    }
    return providerVerificationId;
  }

  /**
   * GET is idempotent — retry briefly, the selfie itself cannot be resubmitted
   */
  private async getResult(providerVerificationId: string): Promise<ProviderResult> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.provider.getResult({ providerVerificationId });
      } catch (error) {
        if (attempt >= RESULT_RETRIES) throw error;
        await this.sleep(1000 * attempt);
      }
    }
  }

  /**
   * Selfie attempt: encrypted copy → liveness + face match → result → finalization
   */
  async uploadSelfie(token: string, image: UploadImage): Promise<{ step: 'DONE'; redirectUrl: string | null }> {
    const verification = await this.loadActive(token);
    if (!canUploadSelfie(verification, this.now())) {
      throw new InvalidStateError('A selfie cannot be uploaded at this step');
    }

    return this.withLock(verification, async (v) => {
      if (!canUploadSelfie(v, this.now())) {
        throw new InvalidStateError('A selfie cannot be uploaded at this step');
      }

      const attempt = v.selfieAttempts + 1;
      const storedPath = await this.storage.save(v.organizationId, v.id, `selfie-${attempt}`, image.buffer);
      const providerVerificationIds = [...v.providerVerificationIds];
      if (v.selfieAttempts > 0) {
        providerVerificationIds.push(await this.reopenProviderSession(v));
      }
      const providerVerificationId = providerVerificationIds[providerVerificationIds.length - 1];

      const outcome = await this.provider.submitSelfie({ providerVerificationId, file: image.buffer, mime: image.mime, attempt });

      if (!outcome.final) {
        const left = attemptsLeft(attempt, this.options.maxSelfieAttempts);
        const patch: VerificationPatch = { selfieAttempts: attempt, providerVerificationIds };
        if (left === 0) {
          Object.assign(patch, applyAttemptsExhausted(v, 'NO_FACE_DETECTED', this.now()));
        }
        await this.repository.update(v.id, patch, { status: 'IN_PROGRESS' });
        logger.info('Selfie rejected', { verificationId: v.id, attempt, reason: outcome.reason, attemptsLeft: left });
        throw new RejectedImageError('SELFIE_REJECTED', left, outcome.reason);
      }

      const result = await this.getResult(providerVerificationId);
      const processing = await this.repository.update(v.id, {
        status: 'PROCESSING',
        selfieAttempts: attempt,
        providerVerificationIds,
        selfieImagePath: storedPath,
        selfieImageMime: image.mime,
        livenessPassed: result.liveness.passed,
        livenessScore: result.liveness.score,
        faceMatchPassed: result.faceMatch.passed,
        faceMatchScore: result.faceMatch.score,
        providerResult: result.raw
      }, { status: 'IN_PROGRESS' });
      if (!processing) {
        throw new InvalidStateError('Verification is no longer in progress');
      }

      await this.finalize(processing, result);
      return { step: 'DONE' as const, redirectUrl: v.redirectUrl };
    });
  }

  /**
   * IDENTITY: provider result is final. FULL_AML: sanctions screening decides.
   */
  private async finalize(v: Verification, result: ProviderResult): Promise<void> {
    const patch = applyProviderResult(v, { outcome: result.outcome, reason: result.reason }, this.now());
    const updated = await this.repository.update(v.id, patch, { status: 'PROCESSING' });
    if (!updated) return;

    logger.info('Identity verification result', {
      verificationId: updated.id,
      organizationId: updated.organizationId,
      providerOutcome: result.outcome,
      status: updated.status
    });

    if (updated.identityMode === 'FULL_AML') {
      await this.screeningService.run(updated);
    }
  }
}

export default PublicSessionService;
