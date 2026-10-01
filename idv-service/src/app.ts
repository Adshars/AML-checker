import express, { type Application as ExpressApplication } from 'express';

// Infrastructure
import { SequelizeConnection } from './infrastructure/database/sequelize/connection.js';
import { createVerificationModel, type VerificationModelStatic } from './infrastructure/database/sequelize/models/VerificationModel.js';
import { SequelizeVerificationRepository } from './infrastructure/database/sequelize/repositories/SequelizeVerificationRepository.js';
import { parseKey } from './infrastructure/security/tokens.js';
import { EncryptedFileStorage } from './infrastructure/storage/EncryptedFileStorage.js';
import { createProvider } from './infrastructure/providers/createProvider.js';

// Application Services
import { VerificationService } from './application/services/VerificationService.js';
import { HealthService } from './application/services/HealthService.js';
import { PublicSessionService } from './application/services/PublicSessionService.js';
import { ScreeningService } from './application/services/ScreeningService.js';
import { MaintenanceJobs } from './application/services/MaintenanceJobs.js';

// API Layer
import { VerificationsController } from './api/controllers/VerificationsController.js';
import { HealthController } from './api/controllers/HealthController.js';
import { PublicSessionController } from './api/controllers/PublicSessionController.js';
import { createVerificationRoutes, createHealthRoutes, createPublicRoutes } from './api/routes/index.js';
import { requestContext } from './api/middlewares/requestContext.js';
import { errorHandler, notFoundHandler } from './api/middlewares/errorHandler.js';

// Shared
import { config } from './shared/config/index.js';
import logger from './shared/logger/index.js';

interface Controllers {
  verificationsController: VerificationsController;
  publicSessionController: PublicSessionController;
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
  maintenanceJobs: MaintenanceJobs | null = null;

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

    // Infrastructure
    const storageKey = parseKey(config.storage.key);
    const storage = new EncryptedFileStorage(config.storage.dir, storageKey);
    const provider = createProvider(config);

    // Application services
    const verificationService = new VerificationService(verificationRepository, storage, {
      publicBaseUrl: config.publicBaseUrl,
      linkTtlHours: config.verification.linkTtlHours,
      provider: config.provider,
      tokenKey: storageKey
    });
    const screeningService = new ScreeningService(verificationRepository);
    const publicSessionService = new PublicSessionService(verificationRepository, provider, storage, screeningService, {
      sessionTtlMinutes: config.verification.sessionTtlMinutes,
      maxDocumentAttempts: config.verification.maxDocumentAttempts,
      maxSelfieAttempts: config.verification.maxSelfieAttempts
    });
    const healthService = new HealthService(this.sequelizeConnection as SequelizeConnection, config.provider);
    this.maintenanceJobs = new MaintenanceJobs(verificationRepository, storage, screeningService, config.verification.imageRetentionDays);

    return {
      verificationsController: new VerificationsController(verificationService),
      publicSessionController: new PublicSessionController(publicSessionService),
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
    this.app.use(createPublicRoutes(controllers.publicSessionController));
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

  /**
   * Maintenance jobs run only in the server process (never in tests)
   */
  startJobs(intervalMs: number): void {
    this.maintenanceJobs?.start(intervalMs);
  }

  async close(): Promise<void> {
    this.maintenanceJobs?.stop();
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
