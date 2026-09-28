import type { Verification } from '../../../domain/entities/Verification.js';
import type { VerificationListResult } from '../../../domain/repositories/IVerificationRepository.js';

/**
 * One row of the verification list
 */
export const toVerificationSummary = (v: Verification) => ({
  id: v.id,
  externalRef: v.externalRef,
  customerName: v.customerName,
  status: v.status,
  identityMode: v.identityMode,
  isDemo: v.isDemo,
  createdBy: { type: v.createdByType, name: v.createdByName },
  createdAt: v.createdAt,
  completedAt: v.completedAt,
  screeningStatus: v.screeningStatus,
  decision: {
    source: v.decisionSource,
    reason: v.decisionReason,
    reviewedByName: v.reviewedByName
  }
});

export type VerificationSummary = ReturnType<typeof toVerificationSummary>;

export interface VerificationListMeta {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
}

/**
 * Paginated list — same meta shape as the sanctions History
 */
export class VerificationListResponseDto {
  data: VerificationSummary[];
  meta: VerificationListMeta;

  constructor(data: VerificationSummary[], meta: VerificationListMeta) {
    this.data = data;
    this.meta = meta;
  }

  static fromQueryResult(result: VerificationListResult, page: number, limit: number): VerificationListResponseDto {
    return new VerificationListResponseDto(result.data.map(toVerificationSummary), {
      totalItems: result.total,
      totalPages: Math.ceil(result.total / limit),
      currentPage: page,
      itemsPerPage: limit
    });
  }

  toJSON(): { data: VerificationSummary[]; meta: VerificationListMeta } {
    return { data: this.data, meta: this.meta };
  }
}

export default VerificationListResponseDto;
