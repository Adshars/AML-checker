import { createApp, Application } from './app.js';
import logger from './shared/logger/index.js';
import { config, validateConfig } from './shared/config/index.js';

/**
 * Bootstrap the application
 */
const bootstrap = async (): Promise<void> => {
  try {
    validateConfig(config);
    const app = await createApp();

    app.listen(config.port, () => {
      logger.info('IDV Service running', {
        port: config.port,
        env: config.nodeEnv,
        provider: config.provider
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server in non-test environment
if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}

export { Application, createApp };
