import type { AuthResult } from '../authMiddleware.js';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: AuthResult;
    }
  }
}

export {};
