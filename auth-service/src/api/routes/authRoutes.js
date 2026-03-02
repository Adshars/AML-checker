import express from 'express';
import { validate, loginSchema } from '../validators/index.js';

/**
 * Create auth routes
 * @param {AuthController} authController
 * @returns {express.Router}
 */
export const createAuthRoutes = (authController) => {
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
