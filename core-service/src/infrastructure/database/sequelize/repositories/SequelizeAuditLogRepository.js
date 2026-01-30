import { Op } from 'sequelize';
import { IAuditLogRepository } from '../../../../domain/repositories/IAuditLogRepository.js';
import { AuditLogMapper } from '../../../mappers/AuditLogMapper.js';

/**
 * Sequelize implementation of AuditLog Repository
 */
export class SequelizeAuditLogRepository extends IAuditLogRepository {
  constructor(auditLogModel) {
    super();
    this.model = auditLogModel;
  }

  async create(auditLog) {
    const persistenceData = AuditLogMapper.toPersistence(auditLog);
    const created = await this.model.create(persistenceData);
    return AuditLogMapper.toDomain(created);
  }

  async findByOrganization(organizationId, options = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      hasHit,
      userId,
      startDate,
      endDate
    } = options;

    const where = { organizationId };

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
      where.createdAt = {};
      if (startDate) {
        where.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.createdAt[Op.lte] = new Date(endDate);
      }
    }

    const offset = (page - 1) * limit;

    const { rows, count } = await this.model.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    return {
      data: rows.map(row => AuditLogMapper.toDomain(row)),
      total: count
    };
  }

  async findAll(options = {}) {
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

    const where = {};

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
      where.createdAt = {};
      if (startDate) {
        where.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.createdAt[Op.lte] = new Date(endDate);
      }
    }

    const offset = (page - 1) * limit;

    const { rows, count } = await this.model.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    return {
      data: rows.map(row => AuditLogMapper.toDomain(row)),
      total: count
    };
  }

  async countByOrganization(organizationId) {
    return this.model.count({ where: { organizationId } });
  }

  async countSanctionedByOrganization(organizationId) {
    return this.model.count({
      where: {
        organizationId,
        isSanctioned: true
      }
    });
  }

  async countPepByOrganization(organizationId) {
    return this.model.count({
      where: {
        organizationId,
        isPep: true
      }
    });
  }

  async getRecentByOrganization(organizationId, limit = 100) {
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
