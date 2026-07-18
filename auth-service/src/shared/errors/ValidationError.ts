import { AppError } from './AppError.js';

/**
 * Validation error for invalid input data
 */
export class ValidationError extends AppError {
  details: unknown;

  constructor(message: string, details: unknown = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }

  toJSON(): ReturnType<AppError['toJSON']> & { details?: unknown } {
    const json = super.toJSON() as ReturnType<AppError['toJSON']> & { details?: unknown };
    if (this.details) {
      json.details = this.details;
    }
    return json;
  }
}

export default ValidationError;
