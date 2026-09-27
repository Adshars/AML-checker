import type { Request, Response, NextFunction, RequestHandler } from 'express';
import logger from './utils/logger.js';
import type { OrganizationServices } from './types/organizationServices.js';

export type GuardedService = 'sanctions' | 'identity';

const isServiceEnabled = (service: GuardedService, services: OrganizationServices): boolean => {
  switch (service) {
    case 'sanctions':
      return services.sanctions;
    case 'identity':
      return services.identityMode !== 'NONE';
    default:
      return false;
  }
};

/**
 * Enforce the organization service package. Must run after AuthMiddleware.
 */
export const requireService = (service: GuardedService): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    // CORS preflight passes through AuthMiddleware without auth context
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    if (!req.auth) {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid credentials' });
      return;
    }

    if (!isServiceEnabled(service, req.auth.services)) {
      logger.warn('Service not enabled for organization', {
        requestId: req.requestId,
        orgId: req.auth.orgId,
        service
      });
      res.status(403).json({ error: 'Service not enabled for organization', service });
      return;
    }

    next();
  };

export default requireService;
