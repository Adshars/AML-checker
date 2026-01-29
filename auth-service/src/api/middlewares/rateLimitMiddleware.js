import rateLimit from 'express-rate-limit';

/**
 * Create rate limiter middleware
 * @param {Object} options - Rate limit options
 * @returns {Function} Express middleware
 */
export const createRateLimiter = (options = {}) => {
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
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many login attempts, please try again later.' }
});

export const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many password reset attempts, please try again later.' }
});

export default { createRateLimiter, loginLimiter, passwordResetLimiter };
