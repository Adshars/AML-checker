import { AppError } from './AppError.js';

/**
 * Forbidden error for authorization failures
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export default ForbiddenError;
