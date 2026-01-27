import express from 'express';
import * as usersController from '../controllers/usersController.js';

const router = express.Router();

/**
 * Users Management Routes (Admin Only)
 * All routes require authentication - handled by API Gateway
 * Gateway injects x-org-id, x-user-id, x-role headers
 */

// Get all users for organization
router.get('/', usersController.getUsers);

// Create new user in organization
router.post('/', usersController.createUser);

// Delete user from organization
router.delete('/:id', usersController.deleteUser);

export default router;
