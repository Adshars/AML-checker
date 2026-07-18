import express from 'express';
import { validateOrgContext } from '../validators/index.js';
/**
 * Create stats routes
 */
export const createStatsRoutes = (statsController) => {
    const router = express.Router();
    // GET /stats - Organization statistics
    router.get('/stats', validateOrgContext, statsController.getStats);
    return router;
};
export default createStatsRoutes;
