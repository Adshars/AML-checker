/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): { error: string; message: string; statusCode: number } {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode
    };
  }
}

export default AppError;
