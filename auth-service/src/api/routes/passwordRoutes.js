import express from 'express';
import { validate, resetPasswordSchema, changePasswordSchema } from '../validators/index.js';

/**
 * Create password routes
 * @param {PasswordController} passwordController
 * @returns {express.Router}
 */
export const createPasswordRoutes = (passwordController) => {
  const router = express.Router();

  // Password Reset Flows
  router.post('/forgot-password', passwordController.forgotPassword);
  router.post('/reset-password', validate(resetPasswordSchema), passwordController.resetPassword);
  router.post('/change-password', validate(changePasswordSchema), passwordController.changePassword);

  return router;
};

export default createPasswordRoutes;
