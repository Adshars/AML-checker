import axios from 'axios';
import logger from '../../shared/logger/index.js';
import { ExternalServiceError } from '../../shared/errors/index.js';

/**
 * HTTP client for OP Adapter service
 * Handles communication with OpenSanctions adapter
 */
export class OpAdapterClient {
  constructor(config) {
    this.baseURL = config.url;
    this.timeout = config.timeout || 30000;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout
    });
  }

  /**
   * Check sanctions against OpenSanctions via OP Adapter
   * @param {Object} params - Check parameters
   * @returns {Promise<{data: Object, duration: number}>}
   */
  async checkSanctions({ name, limit, fuzzy, schema, country, requestId }) {
    const params = { name };

    // Add optional parameters
    if (limit !== undefined) params.limit = limit;
    if (fuzzy !== undefined) params.fuzzy = fuzzy;
    if (schema !== undefined) params.schema = schema;
    if (country !== undefined) params.country = country;

    const headers = requestId ? { 'x-request-id': requestId } : {};

    logger.debug('Forwarding check to OP-Adapter', { requestId, query: name });

    const startTime = Date.now();

    try {
      const response = await this.client.get('/check', { params, headers });
      const duration = Date.now() - startTime;

      logger.debug(`OP-Adapter response received in ${duration}ms`, { requestId });

      return {
        data: response.data,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('OP-Adapter request failed', {
        requestId,
        duration,
        error: error.message,
        status: error.response?.status
      });

      throw new ExternalServiceError('OP-Adapter', error);
    }
  }

  /**
   * Health check for OP Adapter
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

export default OpAdapterClient;
