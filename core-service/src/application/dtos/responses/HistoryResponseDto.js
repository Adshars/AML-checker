import { AuditLogMapper } from '../../../infrastructure/mappers/AuditLogMapper.js';

/**
 * History Response DTO
 */
export class HistoryResponseDto {
  constructor({
    data,
    meta
  }) {
    this.data = data;
    this.meta = meta;
  }

  static fromQueryResult(result, page, limit) {
    const totalPages = Math.ceil(result.total / limit);

    return new HistoryResponseDto({
      data: result.data.map(entity => AuditLogMapper.toResponse(entity)),
      meta: {
        totalItems: result.total,
        totalPages,
        currentPage: page,
        itemsPerPage: limit
      }
    });
  }

  toJSON() {
    return {
      data: this.data,
      meta: this.meta
    };
  }
}

export default HistoryResponseDto;
