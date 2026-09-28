export type ProviderName = 'idswyft' | 'fake';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: {
    host: string;
    user: string;
    password: string;
    name: string;
    dialect: 'postgres';
    logging: false;
  };
  provider: ProviderName;
  idswyft: {
    url: string;
    apiKey: string;
    timeout: number;
  };
  coreService: {
    url: string;
  };
  publicBaseUrl: string;
  storage: {
    dir: string;
    key: string;
  };
  verification: {
    linkTtlHours: number;
    sessionTtlMinutes: number;
    imageRetentionDays: number;
    maxDocumentAttempts: number;
    maxSelfieAttempts: number;
  };
  jobsIntervalMs: number;
  pagination: {
    defaultPage: number;
    defaultLimit: number;
    maxLimit: number;
  };
}

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Application configuration
 * Centralizes all environment variables and configuration
 */
export const config: AppConfig = {
  // Server
  port: toInt(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database (PostgreSQL, own database in the shared container)
  database: {
    host: process.env.DB_HOST || 'postgres',
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || '',
    name: process.env.IDV_DB_NAME || 'idv_db',
    dialect: 'postgres',
    logging: false
  },

  // Identity provider
  provider: process.env.IDV_PROVIDER === 'fake' ? 'fake' : 'idswyft',
  idswyft: {
    url: process.env.IDSWYFT_API_URL || 'http://idswyft-api:3001',
    apiKey: process.env.IDSWYFT_API_KEY || '',
    timeout: toInt(process.env.IDSWYFT_TIMEOUT_MS, 90000)
  },

  // Sanctions screening for FULL_AML
  coreService: {
    url: process.env.CORE_SERVICE_URL || 'http://core-service:3000'
  },

  // Base of the customer verification link (the frontend serves /verify/:token)
  publicBaseUrl: (process.env.FRONTEND_URL || 'http://localhost').replace(/\/+$/, ''),

  // Encrypted image copies and verification link tokens (AES-256-GCM)
  storage: {
    dir: process.env.IDV_STORAGE_DIR || '/app/data',
    key: process.env.IDV_STORAGE_KEY || ''
  },

  verification: {
    linkTtlHours: toInt(process.env.IDV_LINK_TTL_HOURS, 72),
    sessionTtlMinutes: toInt(process.env.IDV_SESSION_TTL_MINUTES, 60),
    imageRetentionDays: toInt(process.env.IDV_IMAGE_RETENTION_DAYS, 14),
    maxDocumentAttempts: toInt(process.env.IDV_MAX_DOCUMENT_ATTEMPTS, 3),
    maxSelfieAttempts: toInt(process.env.IDV_MAX_SELFIE_ATTEMPTS, 3)
  },

  jobsIntervalMs: toInt(process.env.IDV_JOBS_INTERVAL_MS, 300000),

  pagination: {
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100
  }
};

const STORAGE_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

/**
 * Fail fast on missing secrets (called on startup, not on import — tests use their own config)
 */
export const validateConfig = (appConfig: AppConfig): void => {
  if (!STORAGE_KEY_PATTERN.test(appConfig.storage.key)) {
    throw new Error('IDV_STORAGE_KEY must be 64 hex characters (32 bytes). Generate one with: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
};

export default config;
