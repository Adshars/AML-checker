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

  /** Scoped to the organization — another organization's verification is never returned */
  findByIdForOrganization(id: string, organizationId: string): Promise<Verification | null>;

  findByOrganization(organizationId: string, query: VerificationListQuery): Promise<VerificationListResult>;

  /**
   * Update only when the conditions still hold; returns the updated verification or null
   */
  update(id: string, patch: VerificationPatch, conditions?: UpdateConditions): Promise<Verification | null>;
}
