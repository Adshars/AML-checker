import express, { type Router } from 'express';
import type { HealthController } from '../controllers/HealthController.js';

/**
 * Create health routes
 */
export const createHealthRoutes = (healthController: HealthController): Router => {
  const router = express.Router();

  router.get('/health', healthController.getHealth);

  return router;
};

export default createHealthRoutes;
