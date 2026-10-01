import express, { type Router } from 'express';
import { uploadImage } from '../middlewares/upload.js';
import { startSessionSchema, validateBody } from '../validators/index.js';
import type { PublicSessionController } from '../controllers/PublicSessionController.js';

/**
 * Customer verification routes (reached through api-gateway /public/idv/sessions, no auth)
 */
export const createPublicRoutes = (controller: PublicSessionController): Router => {
  const router = express.Router();

  router.get('/public/sessions/:token', controller.getSession);
  router.post('/public/sessions/:token/start', validateBody(startSessionSchema), controller.start);
  router.post('/public/sessions/:token/document', uploadImage('document'), controller.uploadDocument);
  router.post('/public/sessions/:token/selfie', uploadImage('selfie'), controller.uploadSelfie);

  return router;
};

export default createPublicRoutes;
