import logger from '../../shared/logger/index.js';
import type { IVerificationRepository } from '../../domain/repositories/IVerificationRepository.js';
import type { EncryptedFileStorage } from '../../infrastructure/storage/EncryptedFileStorage.js';
import type { ScreeningService } from './ScreeningService.js';

const RETENTION_BATCH = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface MaintenanceSummary {
  expired: number;
  purged: number;
  screeningRetried: number;
}

/**
 * Periodic jobs: expire links and sessions, delete images after the retention period,
 * retry failed screenings. Each job is isolated — one failure does not stop the others.
 */
export class MaintenanceJobs {
  repository: IVerificationRepository;
  storage: EncryptedFileStorage;
  screeningService: ScreeningService;
  imageRetentionDays: number;
  timer: NodeJS.Timeout | null = null;

  constructor(
    repository: IVerificationRepository,
    storage: EncryptedFileStorage,
    screeningService: ScreeningService,
    imageRetentionDays: number
  ) {
    this.repository = repository;
    this.storage = storage;
    this.screeningService = screeningService;
    this.imageRetentionDays = imageRetentionDays;
  }

  private async safely(job: string, work: () => Promise<number>): Promise<number> {
    try {
      return await work();
    } catch (error) {
      logger.error('Maintenance job failed', { job, error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }

  async expire(now: Date): Promise<number> {
    return this.repository.expireStale(now);
  }

  /**
   * Images (our encrypted copies) are deleted; the verification result is kept
   */
  async purgeImages(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - this.imageRetentionDays * DAY_MS);
    let purged = 0;

    for (;;) {
      const batch = await this.repository.findForImageRetention(cutoff, RETENTION_BATCH);
      for (const verification of batch) {
        await this.storage.deleteVerificationDir(verification.organizationId, verification.id);
        await this.repository.update(verification.id, {
          documentImagePath: null,
          selfieImagePath: null,
          imagesPurgedAt: now
        });
        purged += 1;
      }
      if (batch.length < RETENTION_BATCH) break;
    }
    return purged;
  }

  async runOnce(now: Date = new Date()): Promise<MaintenanceSummary> {
    const summary = {
      expired: await this.safely('expire', () => this.expire(now)),
      purged: await this.safely('image-retention', () => this.purgeImages(now)),
      screeningRetried: await this.safely('screening-retry', () => this.screeningService.retryFailed(now))
    };
    if (summary.expired || summary.purged || summary.screeningRetried) {
      logger.info('Maintenance jobs finished', summary);
    }
    return summary;
  }

  start(intervalMs: number): void {
    this.stop();
    this.timer = setInterval(() => { void this.runOnce(); }, intervalMs);
    this.timer.unref();
    void this.runOnce();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

export default MaintenanceJobs;
