import { Sequelize } from 'sequelize';
import logger from '../../../shared/logger/index.js';

/**
 * Sequelize connection manager
 */
export class SequelizeConnection {
  constructor(config) {
    this.config = config;
    this.sequelize = new Sequelize(
      config.name,
      config.user,
      config.password,
      {
        host: config.host,
        dialect: config.dialect,
        logging: config.logging
      }
    );
  }

  /**
   * Get Sequelize instance
   */
  getInstance() {
    return this.sequelize;
  }

  /**
   * Backwards-compatible getter
   */
  getSequelize() {
    return this.getInstance();
  }

  /**
   * Authenticate and test connection
   */
  async authenticate() {
    try {
      await this.sequelize.authenticate();
      logger.info('Database connection established', {
        host: this.config.host,
        database: this.config.name
      });
      return true;
    } catch (error) {
      logger.error('Database connection failed', {
        error: error.message,
        host: this.config.host
      });
      throw error;
    }
  }

  /**
   * Backwards-compatible connect
   */
  async connect() {
    return this.authenticate();
  }

  /**
   * Sync all models
   */
  async sync(options = { alter: true }) {
    try {
      await this.sequelize.sync(options);
      logger.info('Database synchronized');
      return true;
    } catch (error) {
      logger.error('Database sync failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.sequelize.connectionManager.pool !== null;
  }

  /**
   * Health check helper
   */
  async isHealthy() {
    try {
      await this.sequelize.authenticate();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    try {
      return this.sequelize.connectionManager.pool ? 'Connected' : 'Disconnected';
    } catch {
      return 'Disconnected';
    }
  }

  /**
   * Close connection
   */
  async close() {
    await this.sequelize.close();
    logger.info('Database connection closed');
  }

  /**
   * Backwards-compatible disconnect
   */
  async disconnect() {
    return this.close();
  }
}

export default SequelizeConnection;
