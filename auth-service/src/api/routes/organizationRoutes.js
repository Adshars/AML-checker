import express from 'express';
import { validate, registerOrgSchema } from '../validators/index.js';

/**
 * Create organization routes
 * @param {OrganizationController} organizationController
 * @returns {express.Router}
 */
export const createOrganizationRoutes = (organizationController) => {
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
