import axios from 'axios';
import logger from '../utils/logger.js';

const DEFAULT_OP_ADAPTER_URL = process.env.OP_ADAPTER_URL || 'http://op-adapter:3000';
const DEFAULT_TIMEOUT_MS = 10000;

export default class OpAdapterClient {
  constructor({ baseURL = DEFAULT_OP_ADAPTER_URL, timeout = DEFAULT_TIMEOUT_MS } = {}) {
    this.client = axios.create({
      baseURL,
      timeout,
    });
  }

  async checkSanctions({ name, limit, fuzzy, schema, country, requestId }) {
    const params = { name, limit, fuzzy, schema, country };
    const headers = requestId ? { 'x-request-id': requestId } : {};

    logger.debug('Forwarding check to OP-Adapter', { requestId, query: name });

    const startTime = Date.now();
    const response = await this.client.get('/check', { params, headers });
    const duration = Date.now() - startTime;

    logger.debug(`OP-Adapter response received in ${duration}ms`, { requestId });

    return {
      data: response.data,
      duration,
    };
  }
}
