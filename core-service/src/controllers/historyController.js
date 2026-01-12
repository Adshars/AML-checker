import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';
import { Op } from 'sequelize';

export const getHistory = async (req, res) => {
    const orgID = req.headers['x-org-id'];
    const userRole = req.headers['x-role'];
    const requestId = req.headers['x-request-id'] || `hist-${Date.now()}`;

    // validation: Ensure orgID is present for non-superadmin users
    if (!orgID && userRole !== 'superadmin') {
        logger.warn('Security alert: History access without OrgID', { requestId, ip: req.ip });
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        // download query params for pagination and filtering
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const { search, hasHit, startDate, endDate, userId } = req.query;

        logger.info('Fetching audit history', { requestId, orgID, page, limit, filters: req.query });

        // Building WHERE conditions
        let whereClause = {};

        // Organization Security
        if (userRole === 'superadmin') {
            if (req.query.orgId) whereClause.organizationId = req.query.orgId;
        } else {
            whereClause.organizationId = orgID;
        }

        // Text filter (search by last name)
        if (search) {
            // Op.iLike is "Case Insensitive Like" (for Postgres).
            whereClause.searchQuery = { [Op.iLike]: `%${search}%` };
        }

        // Filter "Was there a hit?" (true/false)
        if (hasHit !== undefined) {
            whereClause.hasHit = (hasHit === 'true');
        }

        // Filter by specific user
        if (userId) {
            whereClause.userId = userId;
        }

        // Date range (Start Date - End Date)
        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate); // >=
            if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);     // <=
        }

        // Executing the database query
        // findAndCountAll is crucial for pagination - returns data AND total record count
        const { count, rows } = await AuditLog.findAndCountAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            limit: limit,
            offset: offset
        });

        // Logging the result
        res.json({
            data: rows,
            meta: {
                totalItems: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                itemsPerPage: limit
            }
        });

    } catch (error) {
        logger.error('Database error retrieving history', { requestId, error: error.message });
        res.status(500).json({ error: 'Internal Server Error', requestId });
    }
};