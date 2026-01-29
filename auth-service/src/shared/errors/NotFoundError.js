import { AppError } from './AppError.js';

/**
 * Not found error for missing resources
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export default NotFoundError;
