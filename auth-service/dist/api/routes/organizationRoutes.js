import express from 'express';
import { validate, registerOrgSchema, updateOrganizationServicesSchema } from '../validators/index.js';
/**
 * Create organization routes
 */
export const createOrganizationRoutes = (organizationController) => {
    const router = express.Router();
    // Organization and Admin Registration
    router.post('/register-organization', validate(registerOrgSchema), organizationController.registerOrganization);
    // API Secret reset
    router.post('/reset-secret', organizationController.resetOrganizationSecret);
    // Organization public API key
    router.get('/organization/keys', organizationController.getOrganizationKeys);
    // SuperAdmin organization management
    router.get('/organizations', organizationController.listOrganizations);
    router.get('/organizations/:id', organizationController.getOrganization);
    router.put('/organizations/:id/services', validate(updateOrganizationServicesSchema), organizationController.updateOrganizationServices);
    return router;
};
export default createOrganizationRoutes;
