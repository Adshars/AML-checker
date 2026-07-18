import { Sequelize } from 'sequelize';
import logger from '../../../shared/logger/index.js';
import type { AppConfig } from '../../../shared/config/index.js';

type DatabaseConfig = AppConfig['database'];

/**
 * Sequelize connection manager
 */
export class SequelizeConnection {
  config: DatabaseConfig;
  sequelize: Sequelize;

  constructor(config: DatabaseConfig) {
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
  getInstance(): Sequelize {
    return this.sequelize;
  }

  /**
   * Backwards-compatible getter
   */
  getSequelize(): Sequelize {
    return this.getInstance();
  }

  /**
   * Authenticate and test connection
   */
  async authenticate(): Promise<boolean> {
    try {
      await this.sequelize.authenticate();
      logger.info('Database connection established', {
        host: this.config.host,
        database: this.config.name
      });
      return true;
    } catch (error) {
      logger.error('Database connection failed', {
        error: error instanceof Error ? error.message : String(error),
        host: this.config.host
      });
      throw error;
    }
  }

  /**
   * Backwards-compatible connect
   */
  async connect(): Promise<boolean> {
    return this.authenticate();
  }

  /**
   * Sync all models
   */
  async sync(options: { alter?: boolean } = { alter: true }): Promise<boolean> {
    try {
      await this.sequelize.sync(options);
      logger.info('Database synchronized');
      return true;
    } catch (error) {
      logger.error('Database sync failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return (this.sequelize as unknown as { connectionManager: { pool: unknown } }).connectionManager.pool !== null;
  }

  /**
   * Health check helper
   */
  async isHealthy(): Promise<boolean> {
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
  getStatus(): 'Connected' | 'Disconnected' {
    try {
      return (this.sequelize as unknown as { connectionManager: { pool: unknown } }).connectionManager.pool ? 'Connected' : 'Disconnected';
    } catch {
      return 'Disconnected';
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    await this.sequelize.close();
    logger.info('Database connection closed');
  }

  /**
   * Backwards-compatible disconnect
   */
  async disconnect(): Promise<void> {
    return this.close();
  }
}

export default SequelizeConnection;
