import SanctionEntity from '../models/SanctionEntity.dto.js';
import logger from '../utils/logger.js';

export class UpstreamError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'UpstreamError';
    this.cause = cause;
  }
}

export default class SanctionsService {
  constructor({ yenteClient }) {
    this.yenteClient = yenteClient;
  }

  async findEntities({ name, limit, fuzzy, schema, country, requestId }) {
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
