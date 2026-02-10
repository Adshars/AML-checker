import { createApp, createDbConnection } from './app.js';
import config from './shared/config/index.js';
import logger from './shared/logger/index.js';

// Create Express app with DI
export const app = createApp();

// Start the server after connecting to the database
if (process.env.NODE_ENV !== 'test') {
  const startServer = async () => {
    try {
      // Connect to MongoDB
      const dbConnection = createDbConnection();
      await dbConnection.connect();

      app.listen(config.port, () => {
        logger.info(`Auth Service running`, {
          port: config.port,
          env: config.nodeEnv
        });
      });
    } catch (error) {
      logger.error('Failed to start server', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  };

  startServer();
}
