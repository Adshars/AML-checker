import { Op } from 'sequelize';
import { IAuditLogRepository, type AuditLogQueryOptions, type AuditLogListQueryOptions, type AuditLogListResult } from '../../../../domain/repositories/IAuditLogRepository.js';
import { AuditLogMapper } from '../../../mappers/AuditLogMapper.js';
import type { AuditLog } from '../../../../domain/entities/AuditLog.js';
import type { AuditLogModelStatic } from '../models/AuditLogModel.js';

/**
 * Sequelize implementation of AuditLog Repository
 */
export class SequelizeAuditLogRepository extends IAuditLogRepository {
  model: AuditLogModelStatic;

  constructor(auditLogModel: AuditLogModelStatic) {
    super();
    this.model = auditLogModel;
  }

  async create(auditLog: AuditLog): Promise<AuditLog> {
    const persistenceData = AuditLogMapper.toPersistence(auditLog);
    const created = await this.model.create(persistenceData);
    return AuditLogMapper.toDomain(created) as AuditLog;
  }

  async findByOrganization(organizationId: string, options: AuditLogQueryOptions = {}): Promise<AuditLogListResult> {
    const {
      page = 1,
      limit = 20,
      search,
      hasHit,
      userId,
      startDate,
      endDate
    } = options;

    const where: Record<string, unknown> = { organizationId };

    // Apply filters
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
    const {
      page = 1,
      limit = 20,
      search,
      hasHit,
      userId,
      startDate,
      endDate,
      orgId
    } = options;

    const where: Record<string, unknown> = {};

    // Filter by organization if provided
    if (orgId) {
      where.organizationId = orgId;
    }

    // Apply filters
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

  async countByOrganization(organizationId: string): Promise<number> {
    return this.model.count({ where: { organizationId } });
  }

  async countSanctionedByOrganization(organizationId: string): Promise<number> {
    return this.model.count({
      where: {
        organizationId,
        isSanctioned: true
      }
    });
  }

  async countPepByOrganization(organizationId: string): Promise<number> {
    return this.model.count({
      where: {
        organizationId,
        isPep: true
      }
    });
  }

  async getRecentByOrganization(organizationId: string, limit = 100): Promise<unknown[]> {
    const rows = await this.model.findAll({
      where: { organizationId },
      order: [['createdAt', 'DESC']],
      limit,
      attributes: ['id', 'searchQuery', 'isSanctioned', 'isPep', 'createdAt']
    });

    // Return raw data for stats summary (not full domain entities)
    return rows;
  }
}

export default SequelizeAuditLogRepository;
