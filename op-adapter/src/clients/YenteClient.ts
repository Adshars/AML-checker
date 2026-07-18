import axios, { type AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import logger from '../utils/logger.js';
import type { YenteResponseItem } from '../models/SanctionEntity.dto.js';

const DEFAULT_BASE_URL = process.env.YENTE_API_URL || 'http://localhost:8000';
const DEFAULT_TIMEOUT_MS = 5000;

export interface YenteSearchResponse {
  results?: YenteResponseItem[];
  hits_count?: number;
  meta?: { source?: string; requestId?: string };
  search_params?: unknown;
}

interface YenteClientOptions {
  baseURL?: string;
  timeout?: number;
}

interface SearchOptions {
  name: string;
  limit: number;
  fuzzy: boolean;
  schema?: string | null;
  country?: string | null;
  requestId?: string;
}

export default class YenteClient {
  private client: AxiosInstance;

  constructor({ baseURL = DEFAULT_BASE_URL, timeout = DEFAULT_TIMEOUT_MS }: YenteClientOptions = {}) {
    this.client = axios.create({
      baseURL,
      timeout,
    });

    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) =>
        axiosRetry.isNetworkOrIdempotentRequestError(error) || (error?.response?.status ?? 0) >= 500,
      onRetry: (retryCount, error, requestConfig) => {
        logger.warn(`Yente API retry #${retryCount}`, {
          url: requestConfig?.url,
          method: requestConfig?.method,
          error: error?.message,
        });
      },
    });
  }

  async search({ name, limit, fuzzy, schema, country, requestId }: SearchOptions): Promise<YenteSearchResponse> {
    const params: Record<string, unknown> = {
      q: name,
      limit,
      fuzzy,
    };
    if (schema) params.schema = schema;
    if (country) params.countries = country;

    const headers = requestId ? { 'x-request-id': requestId } : undefined;

    const response = await this.client.get<YenteSearchResponse>('/search/default', { params, headers });
    return response.data;
  }
}
