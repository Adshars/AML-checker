export interface StatsSummary {
  id: unknown;
  searchQuery: unknown;
  isSanctioned: unknown;
  isPep: unknown;
  createdAt: unknown;
}

interface StatsSourceEntity {
  dataValues?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StatsCounts {
  totalChecks: number;
  sanctionHits: number;
  pepHits: number;
}

export interface StatsResponseDtoParams {
  totalChecks: number;
  sanctionHits: number;
  pepHits: number;
  recentLogs: StatsSummary[];
}

/**
 * Stats Response DTO
 */
export class StatsResponseDto {
  totalChecks: number;
  sanctionHits: number;
  pepHits: number;
  recentLogs: StatsSummary[];

  constructor({
    totalChecks,
    sanctionHits,
    pepHits,
    recentLogs
  }: StatsResponseDtoParams) {
    this.totalChecks = totalChecks;
    this.sanctionHits = sanctionHits;
    this.pepHits = pepHits;
    this.recentLogs = recentLogs;
  }

  /**
   * Map entity to summary format for stats
   * Only include essential fields for dashboard display
   */
  static toSummary(entity: StatsSourceEntity): StatsSummary {
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

  static fromStats(stats: StatsCounts, recentLogs: StatsSourceEntity[]): StatsResponseDto {
    return new StatsResponseDto({
      totalChecks: stats.totalChecks,
      sanctionHits: stats.sanctionHits,
      pepHits: stats.pepHits,
      recentLogs: recentLogs.map(entity => StatsResponseDto.toSummary(entity))
    });
  }

  toJSON(): { totalChecks: number; sanctionHits: number; pepHits: number; recentLogs: StatsSummary[] } {
    return {
      totalChecks: this.totalChecks,
      sanctionHits: this.sanctionHits,
      pepHits: this.pepHits,
      recentLogs: this.recentLogs
    };
  }
}

export default StatsResponseDto;
