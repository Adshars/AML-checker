/**
 * History Query DTO
 */
export class HistoryQueryDto {
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
  }) {
    this.page = parseInt(page, 10) || 1;
    this.limit = parseInt(limit, 10) || 20;
    this.search = search?.trim();
    this.hasHit = hasHit;
    this.startDate = startDate;
    this.endDate = endDate;
    this.userId = userId;
    this.orgId = orgId; // For superadmin filtering
    this.organizationId = organizationId; // Current user's org
    this.role = role;
  }

  static fromRequest(req) {
    return new HistoryQueryDto({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      hasHit: req.query.hasHit,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      userId: req.query.userId,
      orgId: req.query.orgId,
      organizationId: req.headers['x-org-id'],
      role: req.headers['x-role']
    });
  }

  isSuperAdmin() {
    return this.role === 'superadmin';
  }

  hasOrganizationContext() {
    return !!this.organizationId;
  }
}

export default HistoryQueryDto;
