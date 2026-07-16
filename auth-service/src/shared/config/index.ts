export interface AppConfig {
  port: number;
  nodeEnv: string;
  mongoUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  passwordResetExpiresIn: number;
  bcryptSaltRounds: number;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  frontendUrl: string;
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

/**
 * Application configuration
 * Centralizes all environment variables and configuration
 */
export const config: AppConfig = {
  // Server
  port: parseInt(process.env.PORT ?? '', 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/auth_db',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',

  // Password Reset
  passwordResetExpiresIn: 3600, // 1 hour in seconds

  // Bcrypt
  bcryptSaltRounds: 10,

  // Email (SMTP)
  smtp: {
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.EMAIL_PORT ?? '', 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  },

  // Frontend URL for password reset links
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50
  }
};

export default config;
