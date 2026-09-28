import { Op } from 'sequelize';
import { IAuditLogRepository } from '../../../../domain/repositories/IAuditLogRepository.js';
import { AuditLogMapper } from '../../../mappers/AuditLogMapper.js';
/**
 * Sequelize implementation of AuditLog Repository
 */
// Dashboard/stats queries are scoped to a rolling window, not full history.
const STATS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export class SequelizeAuditLogRepository extends IAuditLogRepository {
    model;
    constructor(auditLogModel) {
        super();
        this.model = auditLogModel;
    }
    getStatsWindowStart() {
        return new Date(Date.now() - STATS_WINDOW_MS);
    }
    buildWhere(options, organizationId) {
        const { search, hasHit, userId, startDate, endDate } = options;
        const where = {};
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
            const createdAt = {};
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
    async create(auditLog) {
        const persistenceData = AuditLogMapper.toPersistence(auditLog);
        const created = await this.model.create(persistenceData);
        return AuditLogMapper.toDomain(created);
    }
    async findByOrganization(organizationId, options = {}) {
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
            data: rows.map(row => AuditLogMapper.toDomain(row)),
            total: count
        };
    }
    async findAll(options = {}) {
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
            data: rows.map(row => AuditLogMapper.toDomain(row)),
            total: count
        };
    }
    async findByOrganizationForExport(organizationId, options = {}) {
        const where = this.buildWhere(options, organizationId);
        const rows = await this.model.findAll({ where, order: [['createdAt', 'DESC']] });
        return rows.map(row => AuditLogMapper.toDomain(row));
    }
    async findAllForExport(options = {}) {
        const where = this.buildWhere(options, options.orgId);
        const rows = await this.model.findAll({ where, order: [['createdAt', 'DESC']] });
        return rows.map(row => AuditLogMapper.toDomain(row));
    }
    async countByOrganization(organizationId) {
        return this.model.count({
            where: { organizationId, createdAt: { [Op.gte]: this.getStatsWindowStart() } }
        });
    }
    async countSanctionedByOrganization(organizationId) {
        return this.model.count({
            where: {
                organizationId,
                isSanctioned: true,
                createdAt: { [Op.gte]: this.getStatsWindowStart() }
            }
        });
    }
    async countPepByOrganization(organizationId) {
        return this.model.count({
            where: {
                organizationId,
                isPep: true,
                createdAt: { [Op.gte]: this.getStatsWindowStart() }
            }
        });
    }
    async getRecentByOrganization(organizationId, limit = 100) {
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
