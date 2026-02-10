import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

// Shared
import config from './shared/config/index.js';
import logger from './shared/logger/index.js';

// Infrastructure - Database
import { MongoConnection } from './infrastructure/database/mongoose/connection.js';
import { MongoUserRepository } from './infrastructure/database/mongoose/repositories/MongoUserRepository.js';
import { MongoOrganizationRepository } from './infrastructure/database/mongoose/repositories/MongoOrganizationRepository.js';
import { MongoRefreshTokenRepository } from './infrastructure/database/mongoose/repositories/MongoRefreshTokenRepository.js';
import { MongoPasswordResetTokenRepository } from './infrastructure/database/mongoose/repositories/MongoPasswordResetTokenRepository.js';

// Infrastructure - Services
import { BcryptHashingService } from './infrastructure/services/BcryptHashingService.js';
import { NodemailerEmailService } from './infrastructure/services/NodemailerEmailService.js';

// Application Services
import { TokenService } from './application/services/TokenService.js';
import { AuthenticationService } from './application/services/AuthenticationService.js';
import { OrganizationService } from './application/services/OrganizationService.js';
import { UserService } from './application/services/UserService.js';
import { PasswordService } from './application/services/PasswordService.js';

// API Layer
import { AuthController } from './api/controllers/AuthController.js';
import { OrganizationController } from './api/controllers/OrganizationController.js';
import { UserController } from './api/controllers/UserController.js';
import { PasswordController } from './api/controllers/PasswordController.js';

import { createAuthRoutes } from './api/routes/authRoutes.js';
import { createOrganizationRoutes } from './api/routes/organizationRoutes.js';
import { createUserRoutes, createAuthUserRoutes } from './api/routes/userRoutes.js';
import { createPasswordRoutes } from './api/routes/passwordRoutes.js';

/**
 * Application Factory
 * Creates and configures the Express application with DI
 */
export const createApp = () => {
  const app = express();

  // ==========================================
  // Infrastructure Layer - Repositories
  // ==========================================
  const userRepository = new MongoUserRepository();
  const organizationRepository = new MongoOrganizationRepository();
  const refreshTokenRepository = new MongoRefreshTokenRepository();
  const passwordResetTokenRepository = new MongoPasswordResetTokenRepository();

  // ==========================================
  // Infrastructure Layer - Services
  // ==========================================
  const hashingService = new BcryptHashingService(config.bcryptSaltRounds);
  const emailService = new NodemailerEmailService(config.smtp);

  // ==========================================
  // Application Layer - Services
  // ==========================================
  const tokenConfig = {
    jwtSecret: process.env.JWT_SECRET || config.jwtSecret,
    jwtExpiresIn: process.env.JWT_ACCESS_EXPIRATION || config.jwtExpiresIn,
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || config.jwtSecret,
    refreshTokenExpiresIn: config.refreshTokenExpiresIn
  };

  const tokenService = new TokenService(tokenConfig, refreshTokenRepository);

  const authenticationService = new AuthenticationService(
    userRepository,
    organizationRepository,
    tokenService,
    hashingService
  );

  const organizationService = new OrganizationService(
    organizationRepository,
    userRepository,
    hashingService,
    emailService,
    config
  );

  const userService = new UserService(
    userRepository,
    organizationRepository,
    hashingService,
    emailService,
    config
  );

  const passwordService = new PasswordService(
    userRepository,
    passwordResetTokenRepository,
    hashingService,
    emailService,
    config
  );

  // ==========================================
  // API Layer - Controllers
  // ==========================================
  const authController = new AuthController(authenticationService);
  const organizationController = new OrganizationController(organizationService);
  const userController = new UserController(userService);
  const passwordController = new PasswordController(passwordService);

  // ==========================================
  // Express Middleware
  // ==========================================
  app.use(cors());
  app.use(express.json());

  // ==========================================
  // Health Check
  // ==========================================
  app.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    logger.debug('Health check probe', { dbStatus });
    res.json({ service: 'auth-service', status: 'UP', database: dbStatus });
  });

  // ==========================================
  // Routes
  // ==========================================

  // Auth routes (/auth/login, /auth/refresh, /auth/logout, /auth/internal/validate-api-key)
  app.use('/auth', createAuthRoutes(authController));

  // Organization routes (/auth/register-organization, /auth/reset-secret, /auth/organization/keys)
  app.use('/auth', createOrganizationRoutes(organizationController));

  // User registration route (/auth/register-user)
  app.use('/auth', createAuthUserRoutes(userController));

  // Password routes (/auth/forgot-password, /auth/reset-password, /auth/change-password)
  app.use('/auth', createPasswordRoutes(passwordController));

  // Users Management Routes (/users)
  app.use('/users', createUserRoutes(userController));

  return app;
};

/**
 * Create database connection
 */
export const createDbConnection = () => {
  return new MongoConnection(config.mongoUri);
};

export default createApp;
