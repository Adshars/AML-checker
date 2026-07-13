import { AuditLog, type AdapterCheckResult } from '../../domain/entities/AuditLog.js';
import logger from '../../shared/logger/index.js';
import type { OpAdapterClient } from '../../infrastructure/clients/OpAdapterClient.js';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository.js';
import type { SanctionsCheckRequestDto } from '../dtos/requests/SanctionsCheckRequestDto.js';

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
  async check(requestDto: SanctionsCheckRequestDto): Promise<AdapterCheckResult> {
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
      requestId
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
    try {
      const auditLog = AuditLog.fromCheckResult({
        organizationId: organizationId as string,
        userId: userId || 'API',
        userName: userName || (userId ? 'User' : 'API'),
        userEmail,
        searchQuery: name as string,
        adapterResponse
      });

      await this.auditLogRepository.create(auditLog);

      logger.info('Audit log saved successfully', {
        requestId,
        organizationId,
        hasHit: auditLog.hasHit,
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

    return adapterResponse;
  }
}

export default SanctionsCheckService;
