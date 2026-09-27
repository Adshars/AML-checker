import type { Request, Response, NextFunction } from 'express';

/**
 * Headers set exclusively by the gateway for downstream services.
 * Downstream services trust them, so client-supplied values must never pass through.
 */
export const INTERNAL_HEADERS = [
  'x-org-id',
  'x-org-name',
  'x-org-sanctions',
  'x-org-identity-mode',
  'x-user-id',
  'x-user-name',
  'x-user-email',
  'x-role',
  'x-auth-type',
  'x-source',
  'x-idv-verification-id',
  'x-request-id'
] as const;

/**
 * Remove client-supplied internal headers before any routing
 */
export const stripInternalHeaders = (req: Request, _res: Response, next: NextFunction): void => {
  for (const header of INTERNAL_HEADERS) {
    delete req.headers[header];
  }
  next();
};
