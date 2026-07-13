import type { Request, Response } from 'express';
import logger from '../../shared/logger/index.js';
import type { HealthService } from '../../application/services/HealthService.js';

/**
 * Health Controller
 * Handles health check endpoints
 */
export class HealthController {
  healthService: HealthService;

  constructor(healthService: HealthService) {
    this.healthService = healthService;
  }

  /**
   * Get service health status
   * GET /health
   */
  getHealth = async (_req: Request, res: Response): Promise<void> => {
    logger.debug('Health check requested');
    const healthStatus = await this.healthService.getHealth();
    res.json(healthStatus);
  };
}

export default HealthController;
