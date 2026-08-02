import { Op } from 'sequelize';
import { IAuditLogRepository, type AuditLogQueryOptions, type AuditLogListQueryOptions, type AuditLogListResult } from '../../../../domain/repositories/IAuditLogRepository.js';
import { AuditLogMapper } from '../../../mappers/AuditLogMapper.js';
import type { AuditLog } from '../../../../domain/entities/AuditLog.js';
import type { AuditLogModelStatic } from '../models/AuditLogModel.js';

/**
 * Sequelize implementation of AuditLog Repository
 */
// Dashboard/stats queries are scoped to a rolling window, not full history.
const STATS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export class SequelizeAuditLogRepository extends IAuditLogRepository {
  model: AuditLogModelStatic;

  constructor(auditLogModel: AuditLogModelStatic) {
    super();
    this.model = auditLogModel;
  }

  private getStatsWindowStart(): Date {
    return new Date(Date.now() - STATS_WINDOW_MS);
  }

  private buildWhere(
    options: { search?: string; hasHit?: boolean | string; userId?: string; startDate?: string; endDate?: string },
    organizationId?: string
  ): Record<string, unknown> {
    const { search, hasHit, userId, startDate, endDate } = options;
    const where: Record<string, unknown> = {};

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (search) {
      where.searchQuery = { [Op.iLike]: `%${search}%` };
    }

    if (hasHit !== undefined) {
      where.hasHit = hasHit === 'true' || hasHit === true;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      const createdAt: Record<symbol, Date> = {};
      if (startDate) {
        createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        createdAt[Op.lte] = new Date(endDate);
      }
      where.createdAt = createdAt;
    }

    return where;
  }

  async create(auditLog: AuditLog): Promise<AuditLog> {
    const persistenceData = AuditLogMapper.toPersistence(auditLog);
    const created = await this.model.create(persistenceData);
    return AuditLogMapper.toDomain(created) as AuditLog;
  }

  async findByOrganization(organizationId: string, options: AuditLogQueryOptions = {}): Promise<AuditLogListResult> {
    const { page = 1, limit = 20 } = options;
    const where = this.buildWhere(options, organizationId);
    const offset = (page - 1) * limit;

    const { rows, count } = await this.model.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    return {
      data: rows.map(row => AuditLogMapper.toDomain(row) as AuditLog),
      total: count
    };
  }

  async findAll(options: AuditLogListQueryOptions = {}): Promise<AuditLogListResult> {
    const { page = 1, limit = 20, orgId } = options;
    const where = this.buildWhere(options, orgId);
    const offset = (page - 1) * limit;

    const { rows, count } = await this.model.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    return {
      data: rows.map(row => AuditLogMapper.toDomain(row) as AuditLog),
      total: count
    };
  }

  async findByOrganizationForExport(organizationId: string, options: AuditLogQueryOptions = {}): Promise<AuditLog[]> {
    const where = this.buildWhere(options, organizationId);
    const rows = await this.model.findAll({ where, order: [['createdAt', 'DESC']] });
    return rows.map(row => AuditLogMapper.toDomain(row) as AuditLog);
  }

  async findAllForExport(options: AuditLogListQueryOptions = {}): Promise<AuditLog[]> {
    const where = this.buildWhere(options, options.orgId);
    const rows = await this.model.findAll({ where, order: [['createdAt', 'DESC']] });
    return rows.map(row => AuditLogMapper.toDomain(row) as AuditLog);
  }

  async countByOrganization(organizationId: string): Promise<number> {
    return this.model.count({
      where: { organizationId, createdAt: { [Op.gte]: this.getStatsWindowStart() } }
    });
  }

  async countSanctionedByOrganization(organizationId: string): Promise<number> {
    return this.model.count({
      where: {
        organizationId,
        isSanctioned: true,
        createdAt: { [Op.gte]: this.getStatsWindowStart() }
      }
    });
  }

  async countPepByOrganization(organizationId: string): Promise<number> {
    return this.model.count({
      where: {
        organizationId,
        isPep: true,
        createdAt: { [Op.gte]: this.getStatsWindowStart() }
      }
    });
  }

  async getRecentByOrganization(organizationId: string, limit = 100): Promise<unknown[]> {
    const rows = await this.model.findAll({
      where: { organizationId, createdAt: { [Op.gte]: this.getStatsWindowStart() } },
      order: [['createdAt', 'DESC']],
      limit,
      attributes: ['id', 'searchQuery', 'isSanctioned', 'isPep', 'createdAt']
    });

    // Return raw data for stats summary (not full domain entities)
    return rows;
  }
}

export default SequelizeAuditLogRepository;
