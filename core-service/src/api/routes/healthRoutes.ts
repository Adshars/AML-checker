import express, { type Router } from 'express';
import type { HealthController } from '../controllers/HealthController.js';

/**
 * Create health routes
 */
export const createHealthRoutes = (healthController: HealthController): Router => {
  const router = express.Router();

  // GET /health - Health check
  router.get('/health', healthController.getHealth);

  return router;
};

export default createHealthRoutes;
