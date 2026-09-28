import { Sequelize } from 'sequelize';
import pg from 'pg';
import logger from '../../../shared/logger/index.js';
import type { AppConfig } from '../../../shared/config/index.js';

type DatabaseConfig = AppConfig['database'];

const DATABASE_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/;

/**
 * Create the service database if missing. Postgres init scripts run only on an empty volume,
 * so an existing installation would never get idv_db otherwise.
 */
export const ensureDatabaseExists = async (config: DatabaseConfig): Promise<boolean> => {
  if (!DATABASE_NAME_PATTERN.test(config.name)) {
    throw new Error(`Invalid database name: ${config.name}`);
  }

  const client = new pg.Client({
    host: config.host,
    user: config.user,
    password: config.password,
    database: 'postgres'
  });

  await client.connect();
  try {
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.name]);
    if (result.rowCount && result.rowCount > 0) {
      return false;
    }
    // Identifiers cannot be parameterized — the name is validated above
    await client.query(`CREATE DATABASE "${config.name}"`);
    logger.info('Database created', { database: config.name });
    return true;
  } finally {
    await client.end();
  }
};

/**
 * Sequelize connection manager
 */
export class SequelizeConnection {
  config: DatabaseConfig;
  sequelize: Sequelize;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.sequelize = new Sequelize(config.name, config.user, config.password, {
      host: config.host,
      dialect: config.dialect,
      logging: config.logging
    });
  }

  getSequelize(): Sequelize {
    return this.sequelize;
  }

  async connect(): Promise<void> {
    await ensureDatabaseExists(this.config);
    await this.sequelize.authenticate();
    logger.info('Database connection established', { host: this.config.host, database: this.config.name });
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.sequelize.authenticate();
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.sequelize.close();
    logger.info('Database connection closed');
  }
}

export default SequelizeConnection;
