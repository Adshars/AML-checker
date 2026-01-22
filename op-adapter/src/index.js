import logger from './utils/logger.js';
import createApp from './app.js';

export const app = createApp();
const PORT = 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info('OP-Adapter service started', { port: PORT, env: process.env.NODE_ENV || 'development' });
  });
}