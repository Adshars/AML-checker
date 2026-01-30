import { AppError } from './AppError.js';

/**
 * External service error for downstream service failures
 * Used when OP Adapter or other external services fail
 */
export class ExternalServiceError extends AppError {
  constructor(serviceName, originalError = null) {
    super(`External service '${serviceName}' error`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.serviceName = serviceName;
    this.originalError = originalError;
  }

  toJSON() {
    const json = super.toJSON();
    json.serviceName = this.serviceName;
    if (this.originalError) {
      json.originalMessage = this.originalError.message;
    }
    return json;
  }
}

export default ExternalServiceError;
