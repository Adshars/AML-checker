import { AppError } from './AppError.js';

/**
 * Conflict error for duplicate resources or conflicting operations
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

export default ConflictError;
