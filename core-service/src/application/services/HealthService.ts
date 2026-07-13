import type { SequelizeConnection } from '../../infrastructure/database/sequelize/connection.js';

export interface HealthStatus {
  service: string;
  status: string;
  database: 'Connected' | 'Disconnected';
}

/**
 * Health Service
 * Handles health check business logic
 */
export class HealthService {
  dbConnection: SequelizeConnection;

  constructor(dbConnection: SequelizeConnection) {
    this.dbConnection = dbConnection;
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<HealthStatus> {
    let dbStatus: 'Connected' | 'Disconnected' = 'Disconnected';

    try {
      const isHealthy = await this.dbConnection.isHealthy();
      dbStatus = isHealthy ? 'Connected' : 'Disconnected';
    } catch {
      dbStatus = 'Disconnected';
    }

    return {
      service: 'core-service',
      status: 'UP',
      database: dbStatus
    };
  }
}

export default HealthService;
