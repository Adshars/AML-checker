import type { Request, Response } from 'express';
import logger from '../../shared/logger/index.js';
import type { StatsService } from '../../application/services/StatsService.js';

/**
 * Stats Controller
 * Handles statistics endpoints
 */
export class StatsController {
  statsService: StatsService;

  constructor(statsService: StatsService) {
    this.statsService = statsService;
  }

  /**
   * Get organization statistics
   * GET /stats
   */
  getStats = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.headers['x-org-id'] as string | undefined;

    try {
      const response = await this.statsService.getStats(orgId as string);
      res.status(200).json(response.toJSON());
    } catch (error) {
      logger.error('Error retrieving stats', {
        organizationId: orgId,
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}

export default StatsController;
