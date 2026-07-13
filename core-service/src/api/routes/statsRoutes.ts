import express, { type Router } from 'express';
import { validateOrgContext } from '../validators/index.js';
import type { StatsController } from '../controllers/StatsController.js';

/**
 * Create stats routes
 */
export const createStatsRoutes = (statsController: StatsController): Router => {
  const router = express.Router();

  // GET /stats - Organization statistics
  router.get('/stats', validateOrgContext, statsController.getStats);

  return router;
};

export default createStatsRoutes;
