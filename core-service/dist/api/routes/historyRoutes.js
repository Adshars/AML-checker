import express from 'express';
import { validateHistoryAccess } from '../validators/index.js';
/**
 * Create history routes
 */
export const createHistoryRoutes = (historyController) => {
    const router = express.Router();
    // GET /history - Audit history with pagination
    router.get('/history', validateHistoryAccess, historyController.getHistory);
    return router;
};
export default createHistoryRoutes;
