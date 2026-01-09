import express from 'express';
import * as adapterController from './controllers/adapterController.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// Routing

// Health check endpoint
app.get('/health', adapterController.getHealth);

// Main verification endpoint
app.get('/check', adapterController.checkEntity);

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`OP-Adapter running on port ${PORT}`);
});