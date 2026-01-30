import { HistoryResponseDto } from '../dtos/responses/HistoryResponseDto.js';
import logger from '../../shared/logger/index.js';

/**
 * Audit Service
 * Handles audit history business logic
 */
export class AuditService {
  constructor(auditLogRepository) {
    this.auditLogRepository = auditLogRepository;
  }

  /**
   * Get audit history with pagination and filtering
   * @param {HistoryQueryDto} queryDto
   * @returns {Promise<HistoryResponseDto>}
   */
  async getHistory(queryDto) {
    const {
      page,
      limit,
      search,
      hasHit,
      startDate,
      endDate,
      userId,
      orgId,
      organizationId,
      role
    } = queryDto;

    let result;

    // Superadmin can see all organizations
    if (role === 'superadmin') {
      result = await this.auditLogRepository.findAll({
        page,
        limit,
        search,
        hasHit,
        startDate,
        endDate,
        userId,
        orgId // Optional filter for specific org
      });
    } else {
      // Regular users see only their organization
      result = await this.auditLogRepository.findByOrganization(organizationId, {
        page,
        limit,
        search,
        hasHit,
        startDate,
        endDate,
        userId
      });
    }

    logger.info('History retrieved', {
      organizationId: orgId || organizationId,
      page,
      totalItems: result.total
    });

    return HistoryResponseDto.fromQueryResult(result, page, limit);
  }
}

export default AuditService;
