import logger from '../../shared/logger/index.js';
import type { Verification } from '../../domain/entities/Verification.js';
import type { IVerificationRepository } from '../../domain/repositories/IVerificationRepository.js';

/**
 * Screening Service — FULL_AML sanctions screening after identity verification.
 * Step 3 placeholder: applies the provider outcome directly. Real screening via core-service
 * replaces run() in the next step.
 */
export class ScreeningService {
  repository: IVerificationRepository;
  now: () => Date;

  constructor(repository: IVerificationRepository, now: () => Date = () => new Date()) {
    this.repository = repository;
    this.now = now;
  }

  async run(verification: Verification): Promise<Verification> {
    const updated = await this.repository.update(verification.id, {
      status: verification.providerOutcome ?? 'MANUAL_REVIEW',
      decisionSource: 'AUTO',
      completedAt: this.now()
    }, { status: 'PROCESSING' });

    logger.info('Screening skipped (not implemented yet)', { verificationId: verification.id });
    return updated ?? verification;
  }

  /**
   * Retry failed screenings (maintenance job) — nothing to retry yet
   */
  async retryFailed(_now: Date): Promise<number> {
    return 0;
  }
}

export default ScreeningService;
