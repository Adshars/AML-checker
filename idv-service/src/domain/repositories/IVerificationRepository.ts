import type { Verification, VerificationPatch, VerificationStatus } from '../entities/Verification.js';

export type NewVerification = Omit<Verification, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export interface VerificationListQuery {
  page: number;
  limit: number;
  status?: VerificationStatus;
  from?: Date;
  to?: Date;
  search?: string;
  includeDemo: boolean;
}

export interface VerificationListResult {
  data: Verification[];
  total: number;
}

/**
 * Fields that must still match for a conditional update (optimistic locking)
 */
export type UpdateConditions = Partial<Pick<Verification, 'status' | 'documentAttempts' | 'selfieAttempts'>>;

/**
 * Verification Repository Interface
 */
export interface IVerificationRepository {
  create(verification: NewVerification): Promise<Verification>;

  findById(id: string): Promise<Verification | null>;

  /** Customer link lookup — tokens are stored only as SHA-256 hashes */
  findByTokenHash(tokenHash: string): Promise<Verification | null>;

  /** Scoped to the organization — another organization's verification is never returned */
  findByIdForOrganization(id: string, organizationId: string): Promise<Verification | null>;

  findByOrganization(organizationId: string, query: VerificationListQuery): Promise<VerificationListResult>;

  /**
   * Update only when the conditions still hold; returns the updated verification or null
   */
  update(id: string, patch: VerificationPatch, conditions?: UpdateConditions): Promise<Verification | null>;

  /**
   * Take the upload lock (free or stale); returns the locked verification or null when busy
   */
  acquireLock(id: string, now: Date, until: Date): Promise<Verification | null>;

  /**
   * PENDING past linkExpiresAt and unlocked IN_PROGRESS past sessionExpiresAt → EXPIRED; returns the count
   */
  expireStale(now: Date): Promise<number>;

  /** Verifications created before the cutoff whose images were not deleted yet */
  findForImageRetention(createdBefore: Date, limit: number): Promise<Verification[]>;
}
