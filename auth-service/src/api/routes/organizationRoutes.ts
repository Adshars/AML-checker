import express, { type Router } from 'express';
import { validate, registerOrgSchema } from '../validators/index.js';
import type { OrganizationController } from '../controllers/OrganizationController.js';

/**
 * Create organization routes
 */
export const createOrganizationRoutes = (organizationController: OrganizationController): Router => {
  const router = express.Router();

  // Organization and Admin Registration
  router.post('/register-organization', validate(registerOrgSchema), organizationController.registerOrganization);

  // API Secret reset
  router.post('/reset-secret', organizationController.resetOrganizationSecret);

  // Organization public API key
  router.get('/organization/keys', organizationController.getOrganizationKeys);

  return router;
};

export default createOrganizationRoutes;
