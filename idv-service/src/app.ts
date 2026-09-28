import express, { type Application as ExpressApplication } from 'express';

// Infrastructure
import { SequelizeConnection } from './infrastructure/database/sequelize/connection.js';
import { createVerificationModel, type VerificationModelStatic } from './infrastructure/database/sequelize/models/VerificationModel.js';
import { SequelizeVerificationRepository } from './infrastructure/database/sequelize/repositories/SequelizeVerificationRepository.js';
import { parseKey } from './infrastructure/security/tokens.js';

// Application Services
import { VerificationService } from './application/services/VerificationService.js';
import { HealthService } from './application/services/HealthService.js';

// API Layer
import { VerificationsController } from './api/controllers/VerificationsController.js';
import { HealthController } from './api/controllers/HealthController.js';
import { createVerificationRoutes, createHealthRoutes } from './api/routes/index.js';
import { requestContext } from './api/middlewares/requestContext.js';
import { errorHandler, notFoundHandler } from './api/middlewares/errorHandler.js';

// Shared
import { config } from './shared/config/index.js';
import logger from './shared/logger/index.js';

interface Controllers {
  verificationsController: VerificationsController;
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
  VerificationModel!: VerificationModelStatic;

  constructor() {
    this.app = express();
    this.sequelizeConnection = null;
    this.isInitialized = false;
  }

  /**
   * Create the database if missing, connect and sync models
   */
  async initializeDatabase(): Promise<void> {
    this.sequelizeConnection = new SequelizeConnection(config.database);
    await this.sequelizeConnection.connect();

    const sequelize = this.sequelizeConnection.getSequelize();
    this.VerificationModel = createVerificationModel(sequelize);

    await sequelize.sync({ alter: true });

    logger.info('Database initialized successfully');
  }

  /**
   * Create all dependencies with DI
   */
  createDependencies(): Controllers {
    // Repositories
    const verificationRepository = new SequelizeVerificationRepository(this.VerificationModel);

    // Application services
    const verificationService = new VerificationService(verificationRepository, {
      publicBaseUrl: config.publicBaseUrl,
      linkTtlHours: config.verification.linkTtlHours,
      provider: config.provider,
      tokenKey: parseKey(config.storage.key)
    });
    const healthService = new HealthService(this.sequelizeConnection as SequelizeConnection, config.provider);

    return {
      verificationsController: new VerificationsController(verificationService),
      healthController: new HealthController(healthService)
    };
  }

  configureMiddleware(): void {
    this.app.use(express.json());
    this.app.use(requestContext);
  }

  configureRoutes(controllers: Controllers): void {
    this.app.use(createHealthRoutes(controllers.healthController));
    this.app.use(createVerificationRoutes(controllers.verificationsController));
  }

  configureErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

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

  getApp(): ExpressApplication {
    return this.app;
  }

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

export default createApp;
