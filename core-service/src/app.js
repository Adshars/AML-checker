import express from 'express';
import OpAdapterClient from './clients/OpAdapterClient.js';
import SanctionsCoreService from './services/SanctionsCoreService.js';
import SanctionsController from './controllers/sanctionsController.js';
import * as HistoryController from './controllers/historyController.js';

export const createApp = () => {
  const app = express();
  app.use(express.json());

  // Dependency Injection - Composition Root
  const opAdapterClient = new OpAdapterClient();
  const sanctionsCoreService = new SanctionsCoreService({ opAdapterClient });
  const sanctionsController = new SanctionsController({ sanctionsCoreService });

  // Routes
  app.get('/health', sanctionsController.getHealth);
  app.get('/check', sanctionsController.checkSanctions);
  app.get('/stats', sanctionsController.getStats);
  app.get('/history', HistoryController.getHistory);

  return app;
};

export default createApp;
