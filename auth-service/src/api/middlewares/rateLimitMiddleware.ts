import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: Record<string, unknown>;
}

/**
 * Create rate limiter middleware
 */
export const createRateLimiter = (options: RateLimiterOptions = {}): RateLimitRequestHandler => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 50, // limit each IP to 50 requests per windowMs
    message = { error: 'Too many requests, please try again later.' }
  } = options;

  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Pre-configured rate limiters
export const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many password reset attempts, please try again later.' }
});

export default { createRateLimiter, passwordResetLimiter };
