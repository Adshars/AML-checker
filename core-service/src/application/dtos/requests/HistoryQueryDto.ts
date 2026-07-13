import type { Request } from 'express';

export interface HistoryQueryDtoParams {
  page?: number | string;
  limit?: number | string;
  search?: string;
  hasHit?: boolean | string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  orgId?: string;
  organizationId?: string;
  role?: string;
}

/**
 * History Query DTO
 */
export class HistoryQueryDto {
  page: number;
  limit: number;
  search?: string;
  hasHit?: boolean | string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  orgId?: string;
  organizationId?: string;
  role?: string;

  constructor({
    page = 1,
    limit = 20,
    search,
    hasHit,
    startDate,
    endDate,
    userId,
    orgId,
    organizationId,
    role
  }: HistoryQueryDtoParams) {
    this.page = parseInt(String(page), 10) || 1;
    this.limit = parseInt(String(limit), 10) || 20;
    this.search = search?.trim();
    this.hasHit = hasHit;
    this.startDate = startDate;
    this.endDate = endDate;
    this.userId = userId;
    this.orgId = orgId; // For superadmin filtering
    this.organizationId = organizationId; // Current user's org
    this.role = role;
  }

  static fromRequest(req: Request): HistoryQueryDto {
    return new HistoryQueryDto({
      page: req.query.page as string | undefined,
      limit: req.query.limit as string | undefined,
      search: req.query.search as string | undefined,
      hasHit: req.query.hasHit as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      userId: req.query.userId as string | undefined,
      orgId: req.query.orgId as string | undefined,
      organizationId: req.headers['x-org-id'] as string | undefined,
      role: req.headers['x-role'] as string | undefined
    });
  }

  isSuperAdmin(): boolean {
    return this.role === 'superadmin';
  }

  hasOrganizationContext(): boolean {
    return !!this.organizationId;
  }
}

export default HistoryQueryDto;
