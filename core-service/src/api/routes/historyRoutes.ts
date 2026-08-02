import express, { type Router } from 'express';
import { validateHistoryAccess } from '../validators/index.js';
import type { HistoryController } from '../controllers/HistoryController.js';

/**
 * Create history routes
 */
export const createHistoryRoutes = (historyController: HistoryController): Router => {
  const router = express.Router();

  // GET /history/export - Export full matching history as CSV (must be registered before /history)
  router.get('/history/export', validateHistoryAccess, historyController.exportHistory);

  // GET /history - Audit history with pagination
  router.get('/history', validateHistoryAccess, historyController.getHistory);

  return router;
};

export default createHistoryRoutes;
