import express, { type Router } from 'express';
import { validate, loginSchema } from '../validators/index.js';
import type { AuthController } from '../controllers/AuthController.js';

/**
 * Create auth routes
 */
export const createAuthRoutes = (authController: AuthController): Router => {
  const router = express.Router();

  // Login with validation (rate limiting handled by API Gateway)
  router.post('/login', validate(loginSchema), authController.login);

  // Refresh access token
  router.post('/refresh', authController.refreshAccessToken);

  // Logout
  router.post('/logout', authController.logout);

  // API Key Validation (Internal)
  router.post('/internal/validate-api-key', authController.validateApiKey);

  return router;
};

export default createAuthRoutes;
