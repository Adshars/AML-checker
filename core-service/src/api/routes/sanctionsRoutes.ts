import express, { type Router } from 'express';
import { validateSanctionsCheck } from '../validators/index.js';
import type { SanctionsController } from '../controllers/SanctionsController.js';

/**
 * Create sanctions routes
 */
export const createSanctionsRoutes = (sanctionsController: SanctionsController): Router => {
  const router = express.Router();

  // GET /check - Sanctions check
  router.get('/check', validateSanctionsCheck, sanctionsController.checkSanctions);

  return router;
};

export default createSanctionsRoutes;
