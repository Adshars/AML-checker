/**
 * Application configuration
 * Centralizes all environment variables and configuration
 */
export const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database (PostgreSQL)
  database: {
    host: process.env.DB_HOST || 'postgres',
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'tajne_haslo_postgres',
    name: process.env.POSTGRES_DB || 'core_db',
    dialect: 'postgres',
    logging: false
  },

  // OP Adapter Service
  opAdapter: {
    url: process.env.OP_ADAPTER_URL || 'http://op-adapter:3000',
    timeout: parseInt(process.env.OP_ADAPTER_TIMEOUT, 10) || 30000
  },

  // Pagination defaults
  pagination: {
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100
  }
};

export default config;
