import logger from '../utils/logger.js';
import { AdapterError } from '../services/SanctionsCoreService.js';

export default class SanctionsController {
  constructor({ sanctionsCoreService }) {
    this.sanctionsCoreService = sanctionsCoreService;
  }

  getHealth = async (req, res) => {
    logger.debug('Health check requested');
    const healthStatus = await this.sanctionsCoreService.checkHealth();
    res.json(healthStatus);
  };

  checkSanctions = async (req, res) => {
    const requestId = req.headers['x-request-id'] || `core-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const orgID = req.headers['x-org-id'];
    const userID = req.headers['x-user-id'];

    const { name, limit, fuzzy, schema, country } = req.query;
    const queryName = name?.trim();

    logger.info('Received sanctions check request', { requestId, orgID, userID, queryName });

    if (!queryName) {
      logger.warn('Validation failed: Missing name parameter', { requestId, orgID });
      return res.status(400).json({ error: 'Missing name parameter' });
    }

    if (!orgID) {
      logger.warn('Security alert: Missing Organization Context (x-org-id)', { requestId, ip: req.ip });
      return res.status(403).json({ error: 'Missing Organization Context (x-org-id)' });
    }

    try {
      const responseData = await this.sanctionsCoreService.checkSanctions({
        name: queryName,
        limit,
        fuzzy,
        schema,
        country,
        orgID,
        userID,
        requestId,
      });

      res.json(responseData);
    } catch (error) {
      if (error instanceof AdapterError) {
        logger.error('Adapter error during sanctions check', {
          requestId,
          error: error.message,
          cause: error.cause?.message,
        });
        return res.status(502).json({ error: 'Validation failed downstream' });
      }

      logger.error('Unexpected error during sanctions check', {
        requestId,
        error: error.message,
      });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}