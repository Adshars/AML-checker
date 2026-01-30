/**
 * AuditLog Repository Interface
 * Defines the contract for audit log data access
 */
export class IAuditLogRepository {
  /**
   * Create a new audit log entry
   * @param {AuditLog} auditLog
   * @returns {Promise<AuditLog>}
   */
  async create(auditLog) {
    throw new Error('Method not implemented');
  }

  /**
   * Find audit logs by organization with pagination and filters
   * @param {string} organizationId
   * @param {Object} options - Query options (page, limit, filters)
   * @returns {Promise<{data: AuditLog[], total: number}>}
   */
  async findByOrganization(organizationId, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Find all audit logs with pagination and filters (for superadmin)
   * @param {Object} options - Query options (page, limit, filters, orgId)
   * @returns {Promise<{data: AuditLog[], total: number}>}
   */
  async findAll(options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Count total audit logs for organization
   * @param {string} organizationId
   * @returns {Promise<number>}
   */
  async countByOrganization(organizationId) {
    throw new Error('Method not implemented');
  }

  /**
   * Count sanctioned hits for organization
   * @param {string} organizationId
   * @returns {Promise<number>}
   */
  async countSanctionedByOrganization(organizationId) {
    throw new Error('Method not implemented');
  }

  /**
   * Count PEP hits for organization
   * @param {string} organizationId
   * @returns {Promise<number>}
   */
  async countPepByOrganization(organizationId) {
    throw new Error('Method not implemented');
  }

  /**
   * Get recent audit logs for organization
   * @param {string} organizationId
   * @param {number} limit
   * @returns {Promise<AuditLog[]>}
   */
  async getRecentByOrganization(organizationId, limit = 100) {
    throw new Error('Method not implemented');
  }
}

export default IAuditLogRepository;
