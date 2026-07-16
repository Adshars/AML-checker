import express, { type Router } from 'express';
import { validate, resetPasswordSchema, changePasswordSchema } from '../validators/index.js';
import type { PasswordController } from '../controllers/PasswordController.js';

/**
 * Create password routes
 */
export const createPasswordRoutes = (passwordController: PasswordController): Router => {
  const router = express.Router();

  // Password Reset Flows
  router.post('/forgot-password', passwordController.forgotPassword);
  router.post('/reset-password', validate(resetPasswordSchema), passwordController.resetPassword);
  router.post('/change-password', validate(changePasswordSchema), passwordController.changePassword);

  return router;
};

export default createPasswordRoutes;
