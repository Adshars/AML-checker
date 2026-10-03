import type { Request } from 'express';
import type { AuditLogSource } from '../../../domain/entities/AuditLog.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  source?: AuditLogSource | null;
  idvVerificationId?: string | null;
}

// api-gateway URL-encodes names (non-ASCII characters are invalid in HTTP headers)
const decodeHeader = (value?: string): string | undefined => {
  if (!value) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

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
  source: AuditLogSource | null;
  idvVerificationId: string | null;

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
    requestId,
    source = null,
    idvVerificationId = null
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
    this.source = source;
    this.idvVerificationId = idvVerificationId;
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
      userName: decodeHeader(req.headers['x-user-name'] as string | undefined),
      userEmail: req.headers['x-user-email'] as string | undefined,
      requestId: (req.headers['x-request-id'] as string | undefined) || `req-${Date.now()}`,
      ...SanctionsCheckRequestDto.sourceFromHeaders(req)
    });
  }

  /**
   * x-source / x-idv-verification-id come only from idv-service (api-gateway strips them from clients).
   * The verification id is trusted only together with x-source: idv.
   */
  static sourceFromHeaders(req: Request): { source: AuditLogSource | null; idvVerificationId: string | null } {
    if (req.headers['x-source'] === 'idv') {
      const verificationId = req.headers['x-idv-verification-id'] as string | undefined;
      return { source: 'idv', idvVerificationId: verificationId && UUID_PATTERN.test(verificationId) ? verificationId : null };
    }
    const authType = req.headers['x-auth-type'];
    const source = authType === 'api-key' ? 'api' : authType === 'jwt' ? 'panel' : null;
    return { source, idvVerificationId: null };
  }

  isValid(): boolean {
    return !!(this.name && this.name.length > 0 && this.organizationId);
  }
}

export default SanctionsCheckRequestDto;
