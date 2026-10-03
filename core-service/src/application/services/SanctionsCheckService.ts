import { AuditLog, type AdapterCheckResult } from '../../domain/entities/AuditLog.js';
import logger from '../../shared/logger/index.js';
import type { OpAdapterClient } from '../../infrastructure/clients/OpAdapterClient.js';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository.js';
import type { SanctionsCheckRequestDto } from '../dtos/requests/SanctionsCheckRequestDto.js';

/**
 * Reference to the audit log entry written for a check (null when saving it failed)
 */
export interface AuditReference {
  id: string;
  hasHit: boolean;
  isSanctioned: boolean;
  isPep: boolean;
  entityName: string | null;
  entityScore: number | null;
}

export type SanctionsCheckResult = AdapterCheckResult & { audit: AuditReference | null };

/**
 * Sanctions Check Service
 * Handles sanctions screening business logic
 */
export class SanctionsCheckService {
  opAdapterClient: OpAdapterClient;
  auditLogRepository: IAuditLogRepository;

  constructor(opAdapterClient: OpAdapterClient, auditLogRepository: IAuditLogRepository) {
    this.opAdapterClient = opAdapterClient;
    this.auditLogRepository = auditLogRepository;
  }

  /**
   * Perform sanctions check
   */
  async check(requestDto: SanctionsCheckRequestDto): Promise<SanctionsCheckResult> {
    const {
      name,
      limit,
      fuzzy,
      schema,
      country,
      organizationId,
      userId,
      userName,
      userEmail,
      requestId,
      source,
      idvVerificationId
    } = requestDto;

    // Call OP Adapter
    const result = await this.opAdapterClient.checkSanctions({
      name: name as string,
      limit,
      fuzzy,
      schema,
      country,
      requestId
    });

    const adapterResponse = result.data as AdapterCheckResult;
    const adapterLatency = result.duration;

    // Create audit log (non-blocking failure)
    let audit: AuditReference | null = null;
    try {
      const auditLog = AuditLog.fromCheckResult({
        organizationId: organizationId as string,
        userId: userId || 'API',
        userName: userName || (userId ? 'User' : 'API'),
        userEmail,
        searchQuery: name as string,
        adapterResponse,
        source,
        idvVerificationId
      });

      const saved = await this.auditLogRepository.create(auditLog);
      if (saved?.id) {
        audit = {
          id: saved.id,
          hasHit: saved.hasHit,
          isSanctioned: saved.isSanctioned,
          isPep: saved.isPep,
          entityName: saved.entityName,
          entityScore: saved.entityScore
        };
      }

      logger.info('Audit log saved successfully', {
        requestId,
        organizationId,
        hasHit: auditLog.hasHit,
        source,
        userEmail
      });
    } catch (dbError) {
      logger.error('Failed to save Audit Log', {
        requestId,
        error: dbError instanceof Error ? dbError.message : String(dbError)
      });
      // Continue - don't fail the request
    }

    logger.info('Sanctions check completed', {
      requestId,
      organizationId,
      result: (adapterResponse.hits_count ?? 0) > 0 ? 'HIT' : 'CLEAR',
      adapterLatency
    });

    return { ...adapterResponse, audit };
  }
}

export default SanctionsCheckService;
