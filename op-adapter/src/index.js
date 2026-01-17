import express from 'express';
import * as adapterController from './controllers/adapterController.js';
import logger from './utils/logger.js';

export const app = express();
const PORT = 3000;

app.use(express.json());

// Routing

// Health check endpoint
app.get('/health', adapterController.getHealth);

// Main verification endpoint
app.get('/check', adapterController.checkEntity);

// --- START SERVER ---
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      logger.info(`OP-Adapter service started`, { port: PORT, env: process.env.NODE_ENV || 'development' });
    });
}