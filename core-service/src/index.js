import { createApp, Application } from './app.js';
import logger from './shared/logger/index.js';
import { config } from './shared/config/index.js';

const PORT = config.port || 3000;

/**
 * Bootstrap the application
 */
const bootstrap = async () => {
  try {
    const app = await createApp();

    app.listen(PORT, () => {
      logger.info('Core Service running', {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
        dbStatus: 'Connected',
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server in non-test environment
if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}

// Export for testing
export { Application, createApp };
