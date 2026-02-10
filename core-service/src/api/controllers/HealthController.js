import logger from '../../shared/logger/index.js';

/**
 * Health Controller
 * Handles health check endpoints
 */
export class HealthController {
  constructor(healthService) {
    this.healthService = healthService;
  }

  /**
   * Get service health status
   * GET /health
   */
  getHealth = async (req, res) => {
    logger.debug('Health check requested');
    const healthStatus = await this.healthService.getHealth();
    res.json(healthStatus);
  };
}

export default HealthController;
