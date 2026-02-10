import { AppError } from './AppError.js';

/**
 * Validation error for invalid input data
 */
export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }

  toJSON() {
    const json = super.toJSON();
    if (this.details) {
      json.details = this.details;
    }
    return json;
  }
}

export default ValidationError;
