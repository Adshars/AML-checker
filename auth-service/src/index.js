import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';

const app = express();
const PORT = 3000;

// Connection string do MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/auth_db';

app.use(cors());

app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  res.json({ service: 'auth-service', status: 'UP', database: dbStatus });
});

// Auth Routes
app.use('/auth', authRoutes);

// Start the server after connecting to the database
const startServer = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`🔐 Auth Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1); // Exit the container if the database is not working
  }
};

startServer();