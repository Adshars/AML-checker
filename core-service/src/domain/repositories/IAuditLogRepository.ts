import type { AuditLog } from '../entities/AuditLog.js';

export interface AuditLogQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  hasHit?: boolean | string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogListQueryOptions extends AuditLogQueryOptions {
  orgId?: string;
}

export interface AuditLogListResult {
  data: AuditLog[];
  total: number;
}

/**
 * AuditLog Repository Interface
 * Defines the contract for audit log data access
 */
export class IAuditLogRepository {
  /**
   * Create a new audit log entry
   */
  async create(auditLog: AuditLog): Promise<AuditLog> {
    throw new Error('Method not implemented');
  }

  /**
   * Find audit logs by organization with pagination and filters
   */
  async findByOrganization(organizationId: string, options: AuditLogQueryOptions = {}): Promise<AuditLogListResult> {
    throw new Error('Method not implemented');
  }

  /**
   * Find all audit logs with pagination and filters (for superadmin)
   */
  async findAll(options: AuditLogListQueryOptions = {}): Promise<AuditLogListResult> {
    throw new Error('Method not implemented');
  }

  /**
   * Count total audit logs for organization
   */
  async countByOrganization(organizationId: string): Promise<number> {
    throw new Error('Method not implemented');
  }

  /**
   * Count sanctioned hits for organization
   */
  async countSanctionedByOrganization(organizationId: string): Promise<number> {
    throw new Error('Method not implemented');
  }

  /**
   * Count PEP hits for organization
   */
  async countPepByOrganization(organizationId: string): Promise<number> {
    throw new Error('Method not implemented');
  }

  /**
   * Get recent audit logs for organization
   */
  async getRecentByOrganization(organizationId: string, limit = 100): Promise<unknown[]> {
    throw new Error('Method not implemented');
  }
}

export default IAuditLogRepository;
