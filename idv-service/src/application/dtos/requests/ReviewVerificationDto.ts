import type { ReviewDecision } from '../../../domain/entities/Verification.js';

export interface ReviewVerificationBody {
  decision: ReviewDecision;
  comment?: string | null;
}

/**
 * Review Verification Request DTO (body validated by reviewSchema)
 */
export class ReviewVerificationDto {
  decision: ReviewDecision;
  comment: string | null;

  constructor({ decision, comment }: ReviewVerificationBody) {
    this.decision = decision;
    this.comment = comment?.trim() || null;
  }

  static fromRequest(body: ReviewVerificationBody): ReviewVerificationDto {
    return new ReviewVerificationDto(body);
  }
}

export default ReviewVerificationDto;
