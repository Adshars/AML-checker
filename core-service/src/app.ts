import express, { type Application as ExpressApplication, type Request, type Response } from 'express';

// Infrastructure
import { SequelizeConnection } from './infrastructure/database/sequelize/connection.js';
import { createAuditLogModel } from './infrastructure/database/sequelize/models/AuditLogModel.js';
import type { AuditLogModelStatic } from './infrastructure/database/sequelize/models/AuditLogModel.js';
import { SequelizeAuditLogRepository } from './infrastructure/database/sequelize/repositories/SequelizeAuditLogRepository.js';
import { OpAdapterClient } from './infrastructure/clients/OpAdapterClient.js';

// Application Services
import { SanctionsCheckService } from './application/services/SanctionsCheckService.js';
import { AuditService } from './application/services/AuditService.js';
import { StatsService } from './application/services/StatsService.js';
import { HealthService } from './application/services/HealthService.js';

// API Layer
import { SanctionsController } from './api/controllers/SanctionsController.js';
import { HistoryController } from './api/controllers/HistoryController.js';
import { StatsController } from './api/controllers/StatsController.js';
import { HealthController } from './api/controllers/HealthController.js';
import {
  createSanctionsRoutes,
  createHistoryRoutes,
  createStatsRoutes,
  createHealthRoutes,
} from './api/routes/index.js';

// Shared
import { config } from './shared/config/index.js';
import logger from './shared/logger/index.js';
import { AppError } from './shared/errors/AppError.js';

interface Controllers {
  sanctionsController: SanctionsController;
  historyController: HistoryController;
  statsController: StatsController;
  healthController: HealthController;
}

/**
 * Application factory - Composition Root
 * Wires up all dependencies and returns Express app
 */
export class Application {
  app: ExpressApplication;
  sequelizeConnection: SequelizeConnection | null;
  isInitialized: boolean;
  AuditLogModel!: AuditLogModelStatic;

  constructor() {
    this.app = express();
    this.sequelizeConnection = null;
    this.isInitialized = false;
  }

  /**
   * Initialize database connection and models
   */
  async initializeDatabase(): Promise<void> {
    this.sequelizeConnection = new SequelizeConnection(config.database);
    await this.sequelizeConnection.connect();

    // Create models
    const sequelize = this.sequelizeConnection.getSequelize();
    this.AuditLogModel = createAuditLogModel(sequelize);

    // Sync models
    await sequelize.sync({ alter: true });

    logger.info('Database initialized successfully');
  }

  /**
   * Create all dependencies with DI
   */
  createDependencies(): Controllers {
    // Repositories
    const auditLogRepository = new SequelizeAuditLogRepository(this.AuditLogModel);

    // External clients
    const opAdapterClient = new OpAdapterClient(config.opAdapter);

    // Application services
    const auditService = new AuditService(auditLogRepository);
    const sanctionsCheckService = new SanctionsCheckService(opAdapterClient, auditLogRepository);
    const statsService = new StatsService(auditLogRepository);
    const healthService = new HealthService(this.sequelizeConnection as SequelizeConnection);

    // Controllers
    const sanctionsController = new SanctionsController(sanctionsCheckService);
    const historyController = new HistoryController(auditService);
    const statsController = new StatsController(statsService);
    const healthController = new HealthController(healthService);

    return {
      sanctionsController,
      historyController,
      statsController,
      healthController,
    };
  }

  /**
   * Configure Express middleware
   */
  configureMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  /**
   * Configure routes
   */
  configureRoutes(controllers: Controllers): void {
    const { sanctionsController, historyController, statsController, healthController } = controllers;

    // Mount routes
    this.app.use(createSanctionsRoutes(sanctionsController));
    this.app.use(createHistoryRoutes(historyController));
    this.app.use(createStatsRoutes(statsController));
    this.app.use(createHealthRoutes(healthController));
  }

  /**
   * Configure error handling middleware
   */
  configureErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });

    // Global error handler
    this.app.use((err: unknown, req: Request, res: Response, _next: express.NextFunction) => {
      const error = err instanceof Error ? err : new Error(String(err));

      logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
      });

      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: error.name,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error.message,
      });
    });
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<ExpressApplication> {
    if (this.isInitialized) {
      return this.app;
    }

    await this.initializeDatabase();

    this.configureMiddleware();
    const controllers = this.createDependencies();
    this.configureRoutes(controllers);
    this.configureErrorHandling();

    this.isInitialized = true;
    return this.app;
  }

  /**
   * Get Express app instance
   */
  getApp(): ExpressApplication {
    return this.app;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.sequelizeConnection) {
      await this.sequelizeConnection.disconnect();
    }
  }
}

/**
 * Create and initialize application for production use
 */
export const createApp = async (): Promise<ExpressApplication> => {
  const application = new Application();
  await application.initialize();
  return application.getApp();
};

/**
 * Create app for testing (synchronous, no DB init)
 * Used by tests that mock the database
 */
export const createTestApp = (): ExpressApplication => {
  const app = express();
  app.use(express.json());

  // For backwards compatibility with existing tests
  // Tests will set up their own mocks and routes
  return app;
};

export default createApp;
