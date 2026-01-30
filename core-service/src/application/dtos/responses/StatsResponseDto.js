/**
 * Stats Response DTO
 */
export class StatsResponseDto {
  constructor({
    totalChecks,
    sanctionHits,
    pepHits,
    recentLogs
  }) {
    this.totalChecks = totalChecks;
    this.sanctionHits = sanctionHits;
    this.pepHits = pepHits;
    this.recentLogs = recentLogs;
  }

  /**
   * Map entity to summary format for stats
   * Only include essential fields for dashboard display
   */
  static toSummary(entity) {
    // Handle both domain entity and raw model data
    const data = entity.dataValues || entity;
    return {
      id: data.id,
      searchQuery: data.searchQuery,
      isSanctioned: data.isSanctioned,
      isPep: data.isPep,
      createdAt: data.createdAt
    };
  }

  static fromStats(stats, recentLogs) {
    return new StatsResponseDto({
      totalChecks: stats.totalChecks,
      sanctionHits: stats.sanctionHits,
      pepHits: stats.pepHits,
      recentLogs: recentLogs.map(entity => StatsResponseDto.toSummary(entity))
    });
  }

  toJSON() {
    return {
      totalChecks: this.totalChecks,
      sanctionHits: this.sanctionHits,
      pepHits: this.pepHits,
      recentLogs: this.recentLogs
    };
  }
}

export default StatsResponseDto;
