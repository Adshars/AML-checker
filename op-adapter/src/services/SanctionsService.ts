import SanctionEntity from '../models/SanctionEntity.dto.js';
import logger from '../utils/logger.js';
import type YenteClient from '../clients/YenteClient.js';
import type { ServiceParams } from '../application/dtos/requests/CheckSanctionsRequestDto.js';
import type { SearchStats } from '../application/dtos/responses/CheckSanctionsResponseDto.js';

export class UpstreamError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'UpstreamError';
    this.cause = cause;
  }
}

interface SanctionsServiceDeps {
  yenteClient: YenteClient;
}

export interface FindEntitiesResult {
  results: SanctionEntity[];
  stats: SearchStats;
}

export default class SanctionsService {
  private yenteClient: YenteClient;

  constructor({ yenteClient }: SanctionsServiceDeps) {
    this.yenteClient = yenteClient;
  }

  async findEntities({ name, limit, fuzzy, schema, country, requestId }: ServiceParams): Promise<FindEntitiesResult> {
    const startedAt = Date.now();
    let yenteResponse;

    try {
      yenteResponse = await this.yenteClient.search({ name, limit, fuzzy, schema, country, requestId });
    } catch (error) {
      throw new UpstreamError('Failed to query Yente API', error);
    }

    const rawResults = yenteResponse?.results || [];
    const results = rawResults.map((item) => SanctionEntity.fromYenteResponse(item));
    const hitsCount = yenteResponse?.hits_count ?? results.length;

    const durationMs = Date.now() - startedAt;
    logger.info('Yente search completed', { requestId, hits: hitsCount, durationMs });

    return {
      results,
      stats: {
        hitsCount,
        durationMs,
        source: yenteResponse?.meta?.source || 'OpenSanctions (Yente)',
        requestId: yenteResponse?.meta?.requestId || requestId,
        searchParams: yenteResponse?.search_params,
      },
    };
  }
}
