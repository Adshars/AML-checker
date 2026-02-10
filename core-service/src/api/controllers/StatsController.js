import logger from '../../shared/logger/index.js';

/**
 * Stats Controller
 * Handles statistics endpoints
 */
export class StatsController {
  constructor(statsService) {
    this.statsService = statsService;
  }

  /**
   * Get organization statistics
   * GET /stats
   */
  getStats = async (req, res) => {
    const orgId = req.headers['x-org-id'];

    try {
      const response = await this.statsService.getStats(orgId);
      res.status(200).json(response.toJSON());
    } catch (error) {
      logger.error('Error retrieving stats', {
        organizationId: orgId,
        error: error.message
      });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}

export default StatsController;
