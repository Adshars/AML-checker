import express from 'express';
import { validateSanctionsCheck } from '../validators/index.js';

/**
 * Create sanctions routes
 * @param {SanctionsController} sanctionsController
 * @returns {express.Router}
 */
export const createSanctionsRoutes = (sanctionsController) => {
  const router = express.Router();

  // GET /check - Sanctions check
  router.get('/check', validateSanctionsCheck, sanctionsController.checkSanctions);

  return router;
};

export default createSanctionsRoutes;
