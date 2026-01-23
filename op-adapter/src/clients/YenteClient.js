import axios from 'axios';
import axiosRetry from 'axios-retry';
import logger from '../utils/logger.js';

const DEFAULT_BASE_URL = process.env.YENTE_API_URL || 'http://localhost:8000';
const DEFAULT_TIMEOUT_MS = 5000;

export default class YenteClient {
  constructor({ baseURL = DEFAULT_BASE_URL, timeout = DEFAULT_TIMEOUT_MS } = {}) {
    this.client = axios.create({
      baseURL,
      timeout,
    });

    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) =>
        axiosRetry.isNetworkOrIdempotentRequestError(error) || error?.response?.status >= 500,
      onRetry: (retryCount, error, requestConfig) => {
        logger.warn(`Yente API retry #${retryCount}`, {
          url: requestConfig?.url,
          method: requestConfig?.method,
          error: error?.message,
        });
      },
    });
  }

  async search({ name, limit, fuzzy, schema, country, requestId }) {
    const params = {
      q: name,
      limit,
      fuzzy,
    };
    if (schema) params.schema = schema;
    if (country) params.countries = country;

    const headers = requestId ? { 'x-request-id': requestId } : undefined;

    const response = await this.client.get('/search/default', { params, headers });
    return response.data;
  }
}
