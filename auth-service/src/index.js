import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import logger from './utils/logger.js';

const app = express();
const PORT = 3000;

// Connection string do MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/auth_db';

app.use(cors());

app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  logger.debug('Health check probe', { dbStatus });
  res.json({ service: 'auth-service', status: 'UP', database: dbStatus });
});

// Auth Routes
app.use('/auth', authRoutes);

// Start the server after connecting to the database
const startServer = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    logger.info('Connected to MongoDB', { uri: MONGO_URI.split('@')[1] || 'localhost' });

    app.listen(PORT, () => {
      logger.info(`Auth Service running`, { port: PORT, env: process.env.NODE_ENV || 'development' });
    });
  } catch (error) {
    logger.error('Database connection error', { error: error.message, stack: error.stack });
    process.exit(1); // Exit the container if the database is not working
  }
};

startServer();