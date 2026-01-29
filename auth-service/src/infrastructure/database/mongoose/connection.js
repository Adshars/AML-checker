import mongoose from 'mongoose';
import logger from '../../../shared/logger/index.js';

/**
 * MongoDB connection manager
 */
export class MongoConnection {
  constructor(uri) {
    this.uri = uri;
    this.connection = null;
  }

  async connect() {
    try {
      await mongoose.connect(this.uri);
      this.connection = mongoose.connection;
      const sanitizedUri = this.uri.split('@')[1] || 'localhost';
      logger.info('Connected to MongoDB', { uri: sanitizedUri });
      return this.connection;
    } catch (error) {
      logger.error('Database connection error', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      logger.info('Disconnected from MongoDB');
    }
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }

  getStatus() {
    return mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  }
}

export default MongoConnection;
