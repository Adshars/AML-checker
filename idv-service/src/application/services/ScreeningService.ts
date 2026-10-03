import logger from '../../shared/logger/index.js';
import {
  applyScreeningError,
  applyScreeningImpossible,
  applyScreeningResult,
  type Verification,
  type VerificationPatch
} from '../../domain/entities/Verification.js';
import type { IVerificationRepository } from '../../domain/repositories/IVerificationRepository.js';
import { ScreeningUnavailableError, type CoreServiceClient } from '../../infrastructure/clients/CoreServiceClient.js';

const RETRY_BATCH = 50;
// A screening started by the selfie request is left alone for a while before the job picks it up
const RETRY_GRACE_MS = 60 * 1000;

/**
 * Screening Service — FULL_AML: the person from the document is checked against sanctions / PEP lists
 * through core-service (Yente). A failed screening is never treated as clear.
 */
export class ScreeningService {
  repository: IVerificationRepository;
  coreClient: CoreServiceClient;
  now: () => Date;

  constructor(repository: IVerificationRepository, coreClient: CoreServiceClient, now: () => Date = () => new Date()) {
    this.repository = repository;
    this.coreClient = coreClient;
    this.now = now;
  }

  async run(verification: Verification): Promise<Verification> {
    const fullName = verification.ocr?.fullName?.trim();
    let patch: VerificationPatch;

    if (!fullName) {
      patch = applyScreeningImpossible(verification, 'SCREENING_NO_NAME', this.now());
    } else {
      try {
        const result = await this.coreClient.check({
          organizationId: verification.organizationId,
          fullName,
          verificationId: verification.id
        });
        patch = applyScreeningResult(verification, result, this.now());
      } catch (error) {
        if (!(error instanceof ScreeningUnavailableError)) throw error;
        patch = applyScreeningError(verification, this.now());
      }
    }

    // Guard against a parallel run (selfie request vs retry job)
    const updated = await this.repository.update(verification.id, patch, {
      status: 'PROCESSING',
      screeningAttempts: verification.screeningAttempts
    });

    logger.info('Sanctions screening finished', {
      verificationId: verification.id,
      organizationId: verification.organizationId,
      screeningStatus: patch.screeningStatus,
      attempts: patch.screeningAttempts ?? verification.screeningAttempts,
      status: patch.status ?? verification.status
    });

    return updated ?? verification;
  }

  /**
   * Maintenance job: retry failed screenings (and ones interrupted by a restart)
   */
  async retryFailed(now: Date): Promise<number> {
    const pending = await this.repository.findScreeningRetries(new Date(now.getTime() - RETRY_GRACE_MS), RETRY_BATCH);
    for (const verification of pending) {
      await this.run(verification);
    }
    return pending.length;
  }
}

export default ScreeningService;
