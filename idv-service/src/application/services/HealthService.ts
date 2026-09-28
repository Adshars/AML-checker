import type { SequelizeConnection } from '../../infrastructure/database/sequelize/connection.js';

export interface HealthStatus {
  service: string;
  status: string;
  provider: string;
  db: boolean;
}

/**
 * Health Service
 */
export class HealthService {
  dbConnection: SequelizeConnection;
  provider: string;

  constructor(dbConnection: SequelizeConnection, provider: string) {
    this.dbConnection = dbConnection;
    this.provider = provider;
  }

  async getHealth(): Promise<HealthStatus> {
    let db = false;
    try {
      db = await this.dbConnection.isHealthy();
    } catch {
      db = false;
    }

    return {
      service: 'idv-service',
      status: 'UP',
      provider: this.provider,
      db
    };
  }
}

export default HealthService;
