import sequelize from './config/database.js';
import logger from './utils/logger.js';
import createApp from './app.js';

export const app = createApp();
const PORT = 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    try {
      await sequelize.authenticate();
      await sequelize.sync({ alter: true });
      logger.info('Core Service running', {
        port: PORT,
        dbStatus: 'Connected',
        env: process.env.NODE_ENV || 'development',
      });
    } catch (error) {
      logger.error('Failed to start server', { error: error.message });
    }
  });
}