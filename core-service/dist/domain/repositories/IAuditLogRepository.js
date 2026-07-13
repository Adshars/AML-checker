/**
 * AuditLog Repository Interface
 * Defines the contract for audit log data access
 */
export class IAuditLogRepository {
    /**
     * Create a new audit log entry
     */
    async create(auditLog) {
        throw new Error('Method not implemented');
    }
    /**
     * Find audit logs by organization with pagination and filters
     */
    async findByOrganization(organizationId, options = {}) {
        throw new Error('Method not implemented');
    }
    /**
     * Find all audit logs with pagination and filters (for superadmin)
     */
    async findAll(options = {}) {
        throw new Error('Method not implemented');
    }
    /**
     * Count total audit logs for organization
     */
    async countByOrganization(organizationId) {
        throw new Error('Method not implemented');
    }
    /**
     * Count sanctioned hits for organization
     */
    async countSanctionedByOrganization(organizationId) {
        throw new Error('Method not implemented');
    }
    /**
     * Count PEP hits for organization
     */
    async countPepByOrganization(organizationId) {
        throw new Error('Method not implemented');
    }
    /**
     * Get recent audit logs for organization
     */
    async getRecentByOrganization(organizationId, limit = 100) {
        throw new Error('Method not implemented');
    }
}
export default IAuditLogRepository;
