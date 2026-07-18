import type SanctionEntity from '../../../models/SanctionEntity.dto.js';
import type { SearchParams } from '../requests/CheckSanctionsRequestDto.js';

/**
 * CheckSanctionsResponseDto
 * Formats sanctions check response for API output.
 */

export interface SearchStats {
  hitsCount: number;
  durationMs?: number;
  source?: string;
  requestId?: string;
  searchParams?: unknown;
}

interface ResponseMeta {
  source: string;
  timestamp: string;
  requestId?: string;
}

interface CheckSanctionsResponseDtoParams {
  meta: ResponseMeta;
  query: string;
  searchParams: SearchParams;
  hitsCount: number;
  data: SanctionEntity[];
}

interface FromServiceResultParams {
  query: string;
  searchParams: SearchParams;
  results: SanctionEntity[];
  stats: SearchStats;
}

export default class CheckSanctionsResponseDto {
  meta: ResponseMeta;
  query: string;
  search_params: SearchParams;
  hits_count: number;
  data: SanctionEntity[];

  constructor({ meta, query, searchParams, hitsCount, data }: CheckSanctionsResponseDtoParams) {
    this.meta = meta;
    this.query = query;
    this.search_params = searchParams;
    this.hits_count = hitsCount;
    this.data = data;
  }

  /**
   * Creates response DTO from service results and request data.
   */
  static fromServiceResult({ query, searchParams, results, stats }: FromServiceResultParams): CheckSanctionsResponseDto {
    return new CheckSanctionsResponseDto({
      meta: {
        source: stats.source || 'OpenSanctions (Local Yente)',
        timestamp: new Date().toISOString(),
        requestId: stats.requestId,
      },
      query,
      searchParams,
      hitsCount: stats.hitsCount,
      data: results,
    });
  }

  /**
   * Converts DTO to JSON-serializable object for API response.
   */
  toJSON() {
    return {
      meta: this.meta,
      query: this.query,
      search_params: this.search_params,
      hits_count: this.hits_count,
      data: this.data,
    };
  }
}
