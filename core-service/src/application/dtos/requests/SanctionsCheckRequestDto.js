/**
 * Sanctions Check Request DTO
 */
export class SanctionsCheckRequestDto {
  constructor({
    name,
    limit,
    fuzzy,
    schema,
    country,
    organizationId,
    userId,
    userName,
    userEmail,
    requestId
  }) {
    this.name = name?.trim();
    this.limit = limit;
    this.fuzzy = fuzzy;
    this.schema = schema;
    this.country = country;
    this.organizationId = organizationId;
    this.userId = userId;
    this.userName = userName;
    this.userEmail = userEmail;
    this.requestId = requestId;
  }

  static fromRequest(req) {
    return new SanctionsCheckRequestDto({
      name: req.query.name,
      limit: req.query.limit,
      fuzzy: req.query.fuzzy,
      schema: req.query.schema,
      country: req.query.country,
      organizationId: req.headers['x-org-id'],
      userId: req.headers['x-user-id'],
      userName: req.headers['x-user-name'],
      userEmail: req.headers['x-user-email'],
      requestId: req.headers['x-request-id'] || `req-${Date.now()}`
    });
  }

  isValid() {
    return this.name && this.name.length > 0 && this.organizationId;
  }
}

export default SanctionsCheckRequestDto;
