import logger from '../../shared/logger/index.js';
import { HistoryQueryDto } from '../../application/dtos/requests/HistoryQueryDto.js';

/**
 * History Controller
 * Handles audit history endpoints
 */
export class HistoryController {
  constructor(auditService) {
    this.auditService = auditService;
  }

  /**
   * Get audit history
   * GET /history
   */
  getHistory = async (req, res) => {
    const requestId = req.headers['x-request-id'] || `hist-${Date.now()}`;
    const queryDto = HistoryQueryDto.fromRequest(req);

    logger.info('Fetching audit history', {
      requestId,
      organizationId: queryDto.organizationId || queryDto.orgId,
      page: queryDto.page,
      limit: queryDto.limit,
      filters: {
        search: queryDto.search,
        hasHit: queryDto.hasHit,
        userId: queryDto.userId
      }
    });

    try {
      const response = await this.auditService.getHistory(queryDto);
      res.json(response.toJSON());
    } catch (error) {
      logger.error('Database error retrieving history', {
        requestId,
        error: error.message
      });
      res.status(500).json({ error: 'Internal Server Error', requestId });
    }
  };
}

export default HistoryController;
