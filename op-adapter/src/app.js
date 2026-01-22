import express from 'express';
import YenteClient from './clients/YenteClient.js';
import SanctionsService from './services/SanctionsService.js';
import SanctionsController from './controllers/SanctionsController.js';

export const createApp = () => {
  const app = express();
  app.use(express.json());

  const yenteClient = new YenteClient();
  const sanctionsService = new SanctionsService({ yenteClient });
  const sanctionsController = new SanctionsController({ sanctionsService });

  app.get('/health', sanctionsController.getHealth);
  app.get('/check', sanctionsController.checkSanctions);

  return app;
};

export default createApp;
