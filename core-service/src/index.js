import express from 'express';
import sequelize from './config/database.js';

import * as SanctionsController from './controllers/sanctionsController.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// Health Check
app.get('/health', SanctionsController.getHealth);

// Endpoint for sanctions check

app.get('/check', SanctionsController.checkSanctions);

// Endpoint for retrieving audit history
app.get('/history', SanctionsController.getHistory);

// Start the server after syncing the database

app.listen(PORT, async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync({alter: true});
        console.log(`✅ [CORE] Service running on port ${PORT} & DB Connected`);
    } catch (error) {
        console.error('[CORE] Failed to start server:', error.message);
        process.exit(1);
    }
});