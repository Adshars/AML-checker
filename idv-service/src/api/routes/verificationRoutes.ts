import express, { type Router } from 'express';
import { requireAuthType, requireOrganization } from '../middlewares/requestContext.js';
import {
  createVerificationSchema,
  listVerificationsQuerySchema,
  reviewSchema,
  validateBody,
  validateQuery
} from '../validators/index.js';
import type { VerificationsController } from '../controllers/VerificationsController.js';

/**
 * Create authenticated verification routes (reached through api-gateway /idv)
 */
export const createVerificationRoutes = (controller: VerificationsController): Router => {
  const router = express.Router();

  router.use('/verifications', requireOrganization);

  router.post('/verifications', requireAuthType('api-key'), validateBody(createVerificationSchema), controller.create);

  // Registered before /verifications/:id
  router.post('/verifications/demo', requireAuthType('jwt'), controller.createDemo);

  router.get('/verifications', validateQuery(listVerificationsQuerySchema), controller.list);

  router.get('/verifications/:id', controller.getDetails);

  router.post('/verifications/:id/review', requireAuthType('jwt'), validateBody(reviewSchema), controller.review);

  return router;
};

export default createVerificationRoutes;
