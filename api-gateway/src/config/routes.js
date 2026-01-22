export const ROUTES = [
  {
    context: '/auth',
    target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3000',
    changeOrigin: true,
    pathRewrite: { '^': '/auth' },  // Prepend /auth: /login becomes /auth/login
    authRequired: false,
    limiterType: 'auth',
    protectedPaths: [
      { path: '/reset-secret', method: 'POST' }
    ]
  },
  {
    context: '/sanctions',
    target: process.env.CORE_SERVICE_URL || 'http://core-service:3000',
    changeOrigin: true,
    pathRewrite: { '^/sanctions': '' },
    authRequired: true,
    limiterType: 'api'
  }
];

export const AUTH_LIMITER_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
};

export const API_LIMITER_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
};
