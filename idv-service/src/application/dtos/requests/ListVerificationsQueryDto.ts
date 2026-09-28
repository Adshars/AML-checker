import type { Request } from 'express';
import type { VerificationStatus } from '../../../domain/entities/Verification.js';
import type { VerificationListQuery } from '../../../domain/repositories/IVerificationRepository.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * List Verifications Query DTO (query validated by listVerificationsQuerySchema)
 */
export class ListVerificationsQueryDto implements VerificationListQuery {
  page: number;
  limit: number;
  status?: VerificationStatus;
  from?: Date;
  to?: Date;
  search?: string;
  includeDemo: boolean;

  constructor(query: Record<string, string | undefined>) {
    this.page = parseInt(query.page ?? '', 10) || DEFAULT_PAGE;
    this.limit = parseInt(query.limit ?? '', 10) || DEFAULT_LIMIT;
    this.status = query.status as VerificationStatus | undefined;
    this.from = query.from ? new Date(query.from) : undefined;
    this.to = query.to ? new Date(query.to) : undefined;
    this.search = query.search?.trim() || undefined;
    // Demo verifications are listed unless explicitly hidden
    this.includeDemo = query.includeDemo !== 'false';
  }

  static fromRequest(req: Request): ListVerificationsQueryDto {
    return new ListVerificationsQueryDto(req.query as Record<string, string | undefined>);
  }
}

export default ListVerificationsQueryDto;
