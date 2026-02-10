import express from 'express';

/**
 * Create health routes
 * @param {HealthController} healthController
 * @returns {express.Router}
 */
export const createHealthRoutes = (healthController) => {
  const router = express.Router();

  // GET /health - Health check
  router.get('/health', healthController.getHealth);

  return router;
};

export default createHealthRoutes;
