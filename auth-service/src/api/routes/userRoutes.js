import express from 'express';
import { validate, registerUserSchema } from '../validators/index.js';

/**
 * Create user routes for /users endpoint
 * @param {UserController} userController
 * @returns {express.Router}
 */
export const createUserRoutes = (userController) => {
  const router = express.Router();

  // Get all users for organization
  router.get('/', userController.getUsers);

  // Create new user in organization
  router.post('/', validate(registerUserSchema), userController.createUser);

  // Delete user from organization
  router.delete('/:id', userController.deleteUser);

  return router;
};

/**
 * Create user routes for /auth endpoint
 * @param {UserController} userController
 * @returns {express.Router}
 */
export const createAuthUserRoutes = (userController) => {
  const router = express.Router();

  // User Registration (via /auth/register-user)
  router.post('/register-user', validate(registerUserSchema), userController.registerUser);

  return router;
};

export default createUserRoutes;
