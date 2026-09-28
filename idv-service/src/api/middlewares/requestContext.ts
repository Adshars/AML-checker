import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../shared/errors/index.js';

export type OrgIdentityMode = 'NONE' | 'IDENTITY' | 'FULL_AML';
export type AuthType = 'api-key' | 'jwt';

/**
 * Auth context set by api-gateway (client copies of these headers are stripped there)
 */
export interface RequestContext {
  organizationId: string | null;
  organizationName: string | null;
  identityMode: OrgIdentityMode;
  authType: AuthType | null;
  userId: string | null;
  userName: string | null;
  role: string | null;
  requestId: string;
}

const header = (req: Request, name: string): string | null => {
  const value = req.headers[name];
  const single = Array.isArray(value) ? value[0] : value;
  return single ? single : null;
};

const decodeHeader = (value: string | null): string | null => {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const toIdentityMode = (value: string | null): OrgIdentityMode =>
  value === 'IDENTITY' || value === 'FULL_AML' ? value : 'NONE';

const toAuthType = (value: string | null): AuthType | null =>
  value === 'api-key' || value === 'jwt' ? value : null;

export const requestContext = (req: Request, _res: Response, next: NextFunction): void => {
  req.ctx = {
    organizationId: header(req, 'x-org-id'),
    // Gateway always URL-encodes the organization name (non-ASCII is invalid in headers)
    organizationName: decodeHeader(header(req, 'x-org-name')),
    identityMode: toIdentityMode(header(req, 'x-org-identity-mode')),
    authType: toAuthType(header(req, 'x-auth-type')),
    userId: header(req, 'x-user-id'),
    userName: decodeHeader(header(req, 'x-user-name')),
    role: header(req, 'x-role'),
    requestId: header(req, 'x-request-id') || `idv-${Date.now()}`
  };
  next();
};

/**
 * Verification routes: organization users only, with identity verification enabled
 */
export const requireOrganization = (req: Request, _res: Response, next: NextFunction): void => {
  const ctx = req.ctx as RequestContext;

  if (ctx.role === 'superadmin') {
    next(new ForbiddenError('Superadmin has no access to verifications', 'SUPERADMIN_FORBIDDEN'));
    return;
  }
  if (!ctx.organizationId) {
    next(new UnauthorizedError());
    return;
  }
  // Defense in depth — the gateway already enforces the service package
  if (ctx.identityMode === 'NONE') {
    next(new ForbiddenError('Service not enabled for organization', 'SERVICE_NOT_ENABLED'));
    return;
  }
  next();
};

/**
 * B2B endpoints accept only API keys, panel actions only user sessions
 */
export const requireAuthType = (authType: AuthType): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (req.ctx?.authType !== authType) {
      const message = authType === 'api-key'
        ? 'This endpoint requires API key authentication'
        : 'This endpoint requires a user session';
      next(new ForbiddenError(message, 'FORBIDDEN_AUTH_TYPE'));
      return;
    }
    next();
  };
