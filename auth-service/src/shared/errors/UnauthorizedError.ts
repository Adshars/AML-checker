import { AppError } from './AppError.js';

/**
 * Unauthorized error for authentication failures
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export default UnauthorizedError;
