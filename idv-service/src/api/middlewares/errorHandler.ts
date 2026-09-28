import type { Request, Response, NextFunction } from 'express';
import logger from '../../shared/logger/index.js';
import { AppError } from '../../shared/errors/index.js';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found`, code: 'NOT_FOUND' });
};

/**
 * Global error handler — { error, code, ...extra }. Never logs request bodies (personal data).
 */
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const requestId = req.ctx?.requestId;

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('Request failed', { requestId, path: req.path, code: err.code, error: err.message });
    } else {
      logger.warn('Request rejected', { requestId, path: req.path, code: err.code });
    }
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // Malformed JSON body from express.json()
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Malformed JSON body', code: 'VALIDATION_ERROR' });
    return;
  }

  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Unhandled error', { requestId, path: req.path, method: req.method, error: error.message, stack: error.stack });
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
    code: 'INTERNAL_ERROR'
  });
};
