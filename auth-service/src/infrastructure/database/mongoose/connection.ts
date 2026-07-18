import mongoose, { type Connection } from 'mongoose';
import logger from '../../../shared/logger/index.js';

/**
 * MongoDB connection manager
 */
export class MongoConnection {
  uri: string;
  connection: Connection | null;

  constructor(uri: string) {
    this.uri = uri;
    this.connection = null;
  }

  async connect(): Promise<Connection> {
    try {
      await mongoose.connect(this.uri);
      this.connection = mongoose.connection;
      const sanitizedUri = this.uri.split('@')[1] || 'localhost';
      logger.info('Connected to MongoDB', { uri: sanitizedUri });
      return this.connection;
    } catch (error) {
      logger.error('Database connection error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await mongoose.disconnect();
      logger.info('Disconnected from MongoDB');
    }
  }

  isConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  getStatus(): 'Connected' | 'Disconnected' {
    return mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  }
}

export default MongoConnection;
