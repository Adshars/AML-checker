import type { Request, Response } from 'express';
import logger from '../../shared/logger/index.js';
import { HistoryQueryDto } from '../../application/dtos/requests/HistoryQueryDto.js';
import type { AuditService } from '../../application/services/AuditService.js';

/**
 * History Controller
 * Handles audit history endpoints
 */
export class HistoryController {
  auditService: AuditService;

  constructor(auditService: AuditService) {
    this.auditService = auditService;
  }

  /**
   * Get audit history
   * GET /history
   */
  getHistory = async (req: Request, res: Response): Promise<void> => {
    const requestId = (req.headers['x-request-id'] as string | undefined) || `hist-${Date.now()}`;
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
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Internal Server Error', requestId });
    }
  };
}

export default HistoryController;
