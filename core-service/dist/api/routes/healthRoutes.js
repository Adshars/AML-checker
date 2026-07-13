import express from 'express';
/**
 * Create health routes
 */
export const createHealthRoutes = (healthController) => {
    const router = express.Router();
    // GET /health - Health check
    router.get('/health', healthController.getHealth);
    return router;
};
export default createHealthRoutes;
