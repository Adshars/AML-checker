export type ErrorExtra = Record<string, unknown>;

/**
 * Base application error class
 * Serialized as { error: <message>, code: <code>, ...extra }
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  extra: ErrorExtra;
  isOperational: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', extra: ErrorExtra = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.extra = extra;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): { error: string; code: string } & ErrorExtra {
    return {
      error: this.message,
      code: this.code,
      ...this.extra
    };
  }
}

export default AppError;
