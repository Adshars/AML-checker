import express from 'express';
import sequelize from './config/database.js';
import logger from './utils/logger.js';

import * as SanctionsController from './controllers/sanctionsController.js';
import * as HistoryController from './controllers/historyController.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// Health Check
app.get('/health', SanctionsController.getHealth);

// Endpoint for sanctions check

app.get('/check', SanctionsController.checkSanctions);

// Endpoint for retrieving audit history
app.get('/history', HistoryController.getHistory);

// Start the server after syncing the database

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
        logger.error('Failed to start server or connect to DB', {
            error: error.message,
            stack: error.stack
        })
        process.exit(1);
    }
});