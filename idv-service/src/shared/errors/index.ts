import { AppError, type ErrorExtra } from './AppError.js';

export { AppError, type ErrorExtra };

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details === undefined ? {} : { details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Missing organization context') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * 403 with a specific code: SERVICE_NOT_ENABLED, FORBIDDEN_AUTH_TYPE, SUPERADMIN_FORBIDDEN
 */
export class ForbiddenError extends AppError {
  constructor(message: string, code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Verification not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class InvalidStateError extends AppError {
  constructor(message: string, extra: ErrorExtra = {}) {
    super(message, 409, 'INVALID_STATE', extra);
  }
}
