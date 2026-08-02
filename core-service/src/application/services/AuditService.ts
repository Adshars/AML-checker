import { HistoryResponseDto } from '../dtos/responses/HistoryResponseDto.js';
import logger from '../../shared/logger/index.js';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository.js';
import type { HistoryQueryDto } from '../dtos/requests/HistoryQueryDto.js';
import type { AuditLog } from '../../domain/entities/AuditLog.js';

/**
 * Audit Service
 * Handles audit history business logic
 */
export class AuditService {
  auditLogRepository: IAuditLogRepository;

  constructor(auditLogRepository: IAuditLogRepository) {
    this.auditLogRepository = auditLogRepository;
  }

  /**
   * Get audit history with pagination and filtering
   */
  async getHistory(queryDto: HistoryQueryDto): Promise<HistoryResponseDto> {
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
      result = await this.auditLogRepository.findByOrganization(organizationId as string, {
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

  /**
   * Get all audit logs matching filters, without pagination (for CSV export)
   */
  async exportHistory(queryDto: HistoryQueryDto): Promise<AuditLog[]> {
    const { search, hasHit, startDate, endDate, userId, orgId, organizationId, role } = queryDto;

    if (role === 'superadmin') {
      return this.auditLogRepository.findAllForExport({
        search,
        hasHit,
        startDate,
        endDate,
        userId,
        orgId
      });
    }

    return this.auditLogRepository.findByOrganizationForExport(organizationId as string, {
      search,
      hasHit,
      startDate,
      endDate,
      userId
    });
  }
}

export default AuditService;
