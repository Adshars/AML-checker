/**
 * Health Service
 * Handles health check business logic
 */
export class HealthService {
  constructor(dbConnection) {
    this.dbConnection = dbConnection;
  }

  /**
   * Get service health status
   * @returns {Promise<Object>}
   */
  async getHealth() {
    let dbStatus = 'Disconnected';

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
