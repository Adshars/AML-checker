import type { Options as RateLimitOptions } from 'express-rate-limit';

export interface RouteConfig {
  context: string;
  target: string;
  changeOrigin: boolean;
  pathRewrite: Record<string, string>;
  authRequired: boolean;
  limiterType: 'auth' | 'api';
  protectedPaths?: { path: string; method: string }[];
}

export const ROUTES: RouteConfig[] = [
  {
    context: '/auth',
    target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3000',
    changeOrigin: true,
    pathRewrite: { '^/auth': '/auth' },  // Keep /auth prefix: /auth/login stays /auth/login
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

export const AUTH_LIMITER_CONFIG: Partial<RateLimitOptions> = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many auth requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
};

export const API_LIMITER_CONFIG: Partial<RateLimitOptions> = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
};
