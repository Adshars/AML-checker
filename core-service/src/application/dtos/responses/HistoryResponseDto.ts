import { AuditLogMapper } from '../../../infrastructure/mappers/AuditLogMapper.js';
import type { AuditLog } from '../../../domain/entities/AuditLog.js';

export interface HistoryResponseMeta {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
}

export interface HistoryQueryResult {
  data: AuditLog[];
  total: number;
}

export interface HistoryResponseDtoParams {
  data: unknown[];
  meta: HistoryResponseMeta;
}

/**
 * History Response DTO
 */
export class HistoryResponseDto {
  data: unknown[];
  meta: HistoryResponseMeta;

  constructor({
    data,
    meta
  }: HistoryResponseDtoParams) {
    this.data = data;
    this.meta = meta;
  }

  static fromQueryResult(result: HistoryQueryResult, page: number, limit: number): HistoryResponseDto {
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

  toJSON(): { data: unknown[]; meta: HistoryResponseMeta } {
    return {
      data: this.data,
      meta: this.meta
    };
  }
}

export default HistoryResponseDto;
