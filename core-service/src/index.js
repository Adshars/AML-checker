import express from 'express';
import sequelize from './config/database.js';
import logger from './utils/logger.js';

import * as SanctionsController from './controllers/sanctionsController.js';
import * as HistoryController from './controllers/historyController.js';

export const app = express();
const PORT = 3000;

app.use(express.json());

// Health Check
app.get('/health', SanctionsController.getHealth);

// Endpoint for sanctions check

app.get('/check', SanctionsController.checkSanctions);

// Endpoint for retrieving audit history
app.get('/history', HistoryController.getHistory);

// Start server ONLY if executed directly (not imported by tests)

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, async () => {
        try {
            await sequelize.authenticate();
            await sequelize.sync({alter: true});
            logger.info('Core Service running', {
                port: PORT,
                dbStatus: 'Connected',
                env: process.env.NODE_ENV || 'development'
            });
        } catch (error) {
            logger.error('Failed to start server', { error: error.message });
        }
    });
}