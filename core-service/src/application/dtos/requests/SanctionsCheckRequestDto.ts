import type { Request } from 'express';

export interface SanctionsCheckRequestDtoParams {
  name?: string;
  limit?: string;
  fuzzy?: string;
  schema?: string;
  country?: string;
  organizationId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  requestId?: string;
}

/**
 * Sanctions Check Request DTO
 */
export class SanctionsCheckRequestDto {
  name?: string;
  limit?: string;
  fuzzy?: string;
  schema?: string;
  country?: string;
  organizationId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  requestId?: string;

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
  }: SanctionsCheckRequestDtoParams) {
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

  static fromRequest(req: Request): SanctionsCheckRequestDto {
    return new SanctionsCheckRequestDto({
      name: req.query.name as string | undefined,
      limit: req.query.limit as string | undefined,
      fuzzy: req.query.fuzzy as string | undefined,
      schema: req.query.schema as string | undefined,
      country: req.query.country as string | undefined,
      organizationId: req.headers['x-org-id'] as string | undefined,
      userId: req.headers['x-user-id'] as string | undefined,
      userName: req.headers['x-user-name'] as string | undefined,
      userEmail: req.headers['x-user-email'] as string | undefined,
      requestId: (req.headers['x-request-id'] as string | undefined) || `req-${Date.now()}`
    });
  }

  isValid(): boolean {
    return !!(this.name && this.name.length > 0 && this.organizationId);
  }
}

export default SanctionsCheckRequestDto;
