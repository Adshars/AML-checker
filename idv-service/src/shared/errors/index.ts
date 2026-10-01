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

/**
 * 410 for the customer page: LINK_EXPIRED, SESSION_EXPIRED, ALREADY_COMPLETED
 */
export class GoneError extends AppError {
  constructor(message: string, code: 'LINK_EXPIRED' | 'SESSION_EXPIRED' | 'ALREADY_COMPLETED') {
    super(message, 410, code);
  }
}

export class FileTooLargeError extends AppError {
  constructor(maxMb: number) {
    super(`File is too large (max ${maxMb} MB)`, 413, 'FILE_TOO_LARGE');
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor() {
    super('Only JPEG and PNG images are accepted', 415, 'UNSUPPORTED_MEDIA_TYPE');
  }
}

/**
 * 422: the provider rejected the image, the customer may retry while attemptsLeft > 0
 */
export class RejectedImageError extends AppError {
  constructor(code: 'DOCUMENT_REJECTED' | 'SELFIE_REJECTED', attemptsLeft: number, reason: string | null) {
    const message = code === 'DOCUMENT_REJECTED'
      ? 'The document could not be read'
      : 'No face could be detected in the photo';
    super(message, 422, code, { attemptsLeft, reason });
  }
}

/**
 * 502: identity provider unreachable, timed out or failed — the attempt is not counted
 */
export class ProviderUnavailableError extends AppError {
  constructor(message = 'Identity verification provider is unavailable') {
    super(message, 502, 'PROVIDER_UNAVAILABLE');
  }
}
