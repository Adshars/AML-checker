import axios, { type AxiosInstance } from 'axios';
import logger from '../../shared/logger/index.js';
import type { ScreeningTopMatch } from '../../domain/entities/Verification.js';

const TIMEOUT_MS = 15000;

export interface ScreeningResult {
  hitsCount: number;
  isSanctioned: boolean;
  isPep: boolean;
  topMatch: ScreeningTopMatch | null;
  auditLogId: string;
}

export interface ScreeningRequest {
  organizationId: string;
  fullName: string;
  verificationId: string;
  requestId?: string;
}

/**
 * The check failed or was not recorded in the audit trail — must never be read as "clear"
 */
export class ScreeningUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScreeningUnavailableError';
  }
}

interface CoreCheckResponse {
  hits_count?: number;
  audit?: {
    id?: string;
    hasHit?: boolean;
    isSanctioned?: boolean;
    isPep?: boolean;
    entityName?: string | null;
    entityScore?: number | null;
  } | null;
}

/**
 * core-service sanctions check (Yente via op-adapter) — internal call, recorded in AuditLogs with source "idv"
 */
export class CoreServiceClient {
  http: AxiosInstance;

  constructor(baseUrl: string) {
    this.http = axios.create({ baseURL: baseUrl.replace(/\/+$/, ''), timeout: TIMEOUT_MS });
  }

  async check({ organizationId, fullName, verificationId, requestId }: ScreeningRequest): Promise<ScreeningResult> {
    let data: CoreCheckResponse;
    try {
      const response = await this.http.get<CoreCheckResponse>('/check', {
        params: { name: fullName, schema: 'Person', limit: 10 },
        headers: {
          'x-org-id': organizationId,
          'x-auth-type': 'internal',
          'x-source': 'idv',
          'x-idv-verification-id': verificationId,
          'x-user-id': 'idv-service',
          'x-user-name': encodeURIComponent('IDV auto-screening'),
          'x-user-email': 'idv@system',
          'x-request-id': requestId ?? `idv-screening-${verificationId}`
        }
      });
      data = response.data;
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      const code = (error as { code?: string }).code;
      logger.warn('Sanctions screening request failed', { verificationId, status, error: code || (error instanceof Error ? error.message : 'unknown') });
      throw new ScreeningUnavailableError('Sanctions screening is unavailable');
    }

    const audit = data?.audit;
    if (!audit?.id) {
      // Without an audit entry the screening is not documented — treat as failed
      throw new ScreeningUnavailableError('Sanctions screening was not recorded in the audit trail');
    }

    return {
      hitsCount: typeof data.hits_count === 'number' ? data.hits_count : 0,
      isSanctioned: audit.isSanctioned === true,
      isPep: audit.isPep === true,
      topMatch: audit.entityName ? { name: audit.entityName, score: audit.entityScore ?? null } : null,
      auditLogId: audit.id
    };
  }
}

export default CoreServiceClient;
