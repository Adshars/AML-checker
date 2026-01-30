import { AuditLog } from '../../domain/entities/AuditLog.js';
import logger from '../../shared/logger/index.js';

/**
 * Sanctions Check Service
 * Handles sanctions screening business logic
 */
export class SanctionsCheckService {
  constructor(opAdapterClient, auditLogRepository) {
    this.opAdapterClient = opAdapterClient;
    this.auditLogRepository = auditLogRepository;
  }

  /**
   * Perform sanctions check
   * @param {SanctionsCheckRequestDto} requestDto
   * @returns {Promise<Object>} - Adapter response
   */
  async check(requestDto) {
    const {
      name,
      limit,
      fuzzy,
      schema,
      country,
      organizationId,
      userId,
      userEmail,
      requestId
    } = requestDto;

    // Call OP Adapter
    const result = await this.opAdapterClient.checkSanctions({
      name,
      limit,
      fuzzy,
      schema,
      country,
      requestId
    });

    const adapterResponse = result.data;
    const adapterLatency = result.duration;

    // Create audit log (non-blocking failure)
    try {
      const auditLog = AuditLog.fromCheckResult({
        organizationId,
        userId: userId || 'API',
        userEmail,
        searchQuery: name,
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
        error: dbError.message
      });
      // Continue - don't fail the request
    }

    logger.info('Sanctions check completed', {
      requestId,
      organizationId,
      result: adapterResponse.hits_count > 0 ? 'HIT' : 'CLEAR',
      adapterLatency
    });

    return adapterResponse;
  }
}

export default SanctionsCheckService;
