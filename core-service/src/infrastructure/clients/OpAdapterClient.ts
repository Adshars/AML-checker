import axios, { type AxiosInstance } from 'axios';
import logger from '../../shared/logger/index.js';
import { ExternalServiceError } from '../../shared/errors/index.js';
import type { AppConfig } from '../../shared/config/index.js';

type OpAdapterConfig = AppConfig['opAdapter'];

export interface CheckSanctionsParams {
  name: string;
  limit?: number | string;
  fuzzy?: boolean | string;
  schema?: string;
  country?: string;
  requestId?: string;
}

export interface CheckSanctionsResult {
  data: unknown;
  duration: number;
}

/**
 * HTTP client for OP Adapter service
 * Handles communication with OpenSanctions adapter
 */
export class OpAdapterClient {
  baseURL: string;
  timeout: number;
  client: AxiosInstance;

  constructor(config: OpAdapterConfig) {
    this.baseURL = config.url;
    this.timeout = config.timeout || 30000;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout
    });
  }

  /**
   * Check sanctions against OpenSanctions via OP Adapter
   */
  async checkSanctions({ name, limit, fuzzy, schema, country, requestId }: CheckSanctionsParams): Promise<CheckSanctionsResult> {
    const params: Record<string, unknown> = { name };

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
        error: error instanceof Error ? error.message : String(error),
        status: axios.isAxiosError(error) ? error.response?.status : undefined
      });

      throw new ExternalServiceError('OP-Adapter', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Health check for OP Adapter
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

export default OpAdapterClient;
