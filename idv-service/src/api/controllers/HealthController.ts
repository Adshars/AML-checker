import type { Request, Response } from 'express';
import type { HealthService } from '../../application/services/HealthService.js';

/**
 * Health Controller
 */
export class HealthController {
  healthService: HealthService;

  constructor(healthService: HealthService) {
    this.healthService = healthService;
  }

  /**
   * GET /health
   */
  getHealth = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.healthService.getHealth());
  };
}

export default HealthController;
