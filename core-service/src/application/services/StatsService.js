import { StatsResponseDto } from '../dtos/responses/StatsResponseDto.js';
import logger from '../../shared/logger/index.js';

/**
 * Stats Service
 * Handles statistics aggregation business logic
 */
export class StatsService {
  constructor(auditLogRepository) {
    this.auditLogRepository = auditLogRepository;
  }

  /**
   * Get organization statistics
   * @param {string} organizationId
   * @returns {Promise<StatsResponseDto>}
   */
  async getStats(organizationId) {
    // Get counts in parallel
    const [totalChecks, sanctionHits, pepHits, recentLogs] = await Promise.all([
      this.auditLogRepository.countByOrganization(organizationId),
      this.auditLogRepository.countSanctionedByOrganization(organizationId),
      this.auditLogRepository.countPepByOrganization(organizationId),
      this.auditLogRepository.getRecentByOrganization(organizationId, 100)
    ]);

    const stats = {
      totalChecks,
      sanctionHits,
      pepHits
    };

    logger.info('Stats retrieved', {
      organizationId,
      totalChecks,
      sanctionHits,
      pepHits
    });

    return StatsResponseDto.fromStats(stats, recentLogs);
  }
}

export default StatsService;
