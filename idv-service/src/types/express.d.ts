import type { RequestContext } from '../api/middlewares/requestContext.js';

declare global {
  namespace Express {
    interface Request {
      ctx?: RequestContext;
    }
  }
}

export {};
