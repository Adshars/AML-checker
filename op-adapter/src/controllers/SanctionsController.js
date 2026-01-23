import logger from '../utils/logger.js';
import { UpstreamError } from '../services/SanctionsService.js';

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 100;

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
};

export default class SanctionsController {
  constructor({ sanctionsService }) {
    this.sanctionsService = sanctionsService;
  }

  getHealth = (req, res) => {
    logger.debug('Health check requested');
    res.json({ status: 'UP', service: 'op-adapter', mode: 'ES Modules + Retry' });
  };

  checkSanctions = async (req, res) => {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const name = (req.query.name || '').trim();
    if (!name) {
      logger.warn('Missing name parameter in check request', { requestId });
      return res.status(400).json({ error: 'Missing name parameter' });
    }

    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT) : DEFAULT_LIMIT;
    const fuzzy = toBoolean(req.query.fuzzy ?? 'false');
    const schema = req.query.schema?.trim();
    const country = req.query.country?.trim();

    logger.info('Received check request', { requestId, name, limit, fuzzy, schema, country });

    try {
      const { results, stats } = await this.sanctionsService.findEntities({
        name,
        limit,
        fuzzy,
        schema,
        country,
        requestId,
      });

      res.json({
        meta: {
          source: stats.source,
          timestamp: new Date().toISOString(),
          requestId: stats.requestId || requestId,
        },
        query: name,
        search_params: { limit, fuzzy, schema, country },
        hits_count: stats.hitsCount,
        data: results,
      });
    } catch (error) {
      if (error instanceof UpstreamError) {
        logger.error('Error connecting to Yente (after retries)', {
          requestId,
          error: error.message,
          cause: error.cause?.message,
        });
        return res.status(502).json({
          error: 'Sanctions Service Unavailable',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
      }

      logger.error('Unexpected error during check', { requestId, error: error.message });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
