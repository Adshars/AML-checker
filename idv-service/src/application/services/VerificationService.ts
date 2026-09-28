import logger from '../../shared/logger/index.js';
import { InvalidStateError, NotFoundError, UnauthorizedError } from '../../shared/errors/index.js';
import {
  applyExpiry,
  applyReview,
  buildNewVerification,
  isLinkExpired,
  type IdentityMode,
  type Verification
} from '../../domain/entities/Verification.js';
import type { IVerificationRepository } from '../../domain/repositories/IVerificationRepository.js';
import { decryptToken, encryptToken, generateToken, hashToken } from '../../infrastructure/security/tokens.js';
import type { RequestContext } from '../../api/middlewares/requestContext.js';
import type { CreateVerificationDto } from '../dtos/requests/CreateVerificationDto.js';
import type { ListVerificationsQueryDto } from '../dtos/requests/ListVerificationsQueryDto.js';
import type { ReviewVerificationDto } from '../dtos/requests/ReviewVerificationDto.js';
import { VerificationListResponseDto } from '../dtos/responses/VerificationSummaryDto.js';
import {
  toCreatedVerification,
  toVerificationDetails,
  type CreatedVerification,
  type VerificationDetails
} from '../dtos/responses/VerificationDetailsDto.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface VerificationServiceOptions {
  publicBaseUrl: string;
  linkTtlHours: number;
  provider: string;
  tokenKey: Buffer;
  now?: () => Date;
}

/**
 * Verification Service
 * Verification requests: creation (API / demo), listing, details and manual review
 */
export class VerificationService {
  repository: IVerificationRepository;
  options: VerificationServiceOptions;
  now: () => Date;

  constructor(repository: IVerificationRepository, options: VerificationServiceOptions) {
    this.repository = repository;
    this.options = options;
    this.now = options.now ?? (() => new Date());
  }

  private buildUrl(token: string): string {
    return `${this.options.publicBaseUrl}/verify/${token}`;
  }

  private async createRequest(
    ctx: RequestContext,
    fields: Pick<Verification, 'isDemo' | 'createdByType' | 'createdByUserId' | 'createdByName' | 'externalRef' | 'customerName' | 'redirectUrl'>
  ): Promise<CreatedVerification> {
    const token = generateToken();
    const verification = await this.repository.create(buildNewVerification({
      ...fields,
      organizationId: ctx.organizationId as string,
      organizationName: ctx.organizationName,
      identityMode: ctx.identityMode as IdentityMode,
      tokenHash: hashToken(token),
      tokenEncrypted: encryptToken(token, this.options.tokenKey),
      provider: this.options.provider,
      now: this.now(),
      linkTtlHours: this.options.linkTtlHours
    }));

    logger.info('Verification created', {
      requestId: ctx.requestId,
      verificationId: verification.id,
      organizationId: verification.organizationId,
      identityMode: verification.identityMode,
      isDemo: verification.isDemo
    });

    return toCreatedVerification(verification, this.buildUrl(token));
  }

  /**
   * B2B client (API key) creates a verification link for its customer
   */
  async create(ctx: RequestContext, dto: CreateVerificationDto): Promise<CreatedVerification> {
    return this.createRequest(ctx, {
      isDemo: false,
      createdByType: 'API',
      createdByUserId: null,
      createdByName: null,
      externalRef: dto.externalRef,
      customerName: dto.customerName,
      redirectUrl: dto.redirectUrl
    });
  }

  /**
   * Panel user verifies themselves (demo)
   */
  async createDemo(ctx: RequestContext): Promise<CreatedVerification> {
    return this.createRequest(ctx, {
      isDemo: true,
      createdByType: 'USER',
      createdByUserId: ctx.userId,
      createdByName: ctx.userName,
      externalRef: null,
      customerName: ctx.userName,
      redirectUrl: null
    });
  }

  async list(ctx: RequestContext, query: ListVerificationsQueryDto): Promise<VerificationListResponseDto> {
    const result = await this.repository.findByOrganization(ctx.organizationId as string, query);
    return VerificationListResponseDto.fromQueryResult(result, query.page, query.limit);
  }

  /**
   * Another organization's verification is reported as not found (no enumeration)
   */
  private async findOwned(ctx: RequestContext, id: string): Promise<Verification> {
    const verification = UUID_PATTERN.test(id)
      ? await this.repository.findByIdForOrganization(id, ctx.organizationId as string)
      : null;
    if (!verification) {
      throw new NotFoundError();
    }

    // Lazy expiry — the maintenance job may not have run yet
    const expiry = applyExpiry(verification, this.now());
    if (expiry) {
      const updated = await this.repository.update(verification.id, expiry, { status: verification.status });
      if (updated) return updated;
    }
    return verification;
  }

  private linkFor(verification: Verification): string | null {
    if (verification.status !== 'PENDING' || !verification.tokenEncrypted || isLinkExpired(verification, this.now())) {
      return null;
    }
    try {
      return this.buildUrl(decryptToken(verification.tokenEncrypted, this.options.tokenKey));
    } catch {
      // Encrypted with a different IDV_STORAGE_KEY — the link cannot be shown again
      logger.warn('Cannot decrypt verification link token', { verificationId: verification.id });
      return null;
    }
  }

  async getDetails(ctx: RequestContext, id: string): Promise<VerificationDetails> {
    const verification = await this.findOwned(ctx, id);
    return toVerificationDetails(verification, this.linkFor(verification));
  }

  /**
   * MANUAL_REVIEW → VERIFIED / REJECTED, recording who decided
   */
  async review(ctx: RequestContext, id: string, dto: ReviewVerificationDto): Promise<VerificationDetails> {
    if (!ctx.userId) {
      throw new UnauthorizedError('Missing user context');
    }

    const verification = await this.findOwned(ctx, id);
    const patch = applyReview(verification, {
      decision: dto.decision,
      comment: dto.comment,
      reviewerId: ctx.userId,
      reviewerName: ctx.userName
    }, this.now());

    // Another reviewer may have decided in the meantime
    const updated = await this.repository.update(verification.id, patch, { status: 'MANUAL_REVIEW' });
    if (!updated) {
      throw new InvalidStateError('Verification was already reviewed');
    }

    logger.info('Verification reviewed', {
      requestId: ctx.requestId,
      verificationId: updated.id,
      organizationId: updated.organizationId,
      decision: dto.decision,
      status: updated.status
    });

    return toVerificationDetails(updated, null);
  }
}

export default VerificationService;
