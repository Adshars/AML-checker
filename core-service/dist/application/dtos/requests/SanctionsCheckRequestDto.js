const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// api-gateway URL-encodes names (non-ASCII characters are invalid in HTTP headers)
const decodeHeader = (value) => {
    if (!value)
        return value;
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
};
/**
 * Sanctions Check Request DTO
 */
export class SanctionsCheckRequestDto {
    name;
    limit;
    fuzzy;
    schema;
    country;
    organizationId;
    userId;
    userName;
    userEmail;
    requestId;
    source;
    idvVerificationId;
    constructor({ name, limit, fuzzy, schema, country, organizationId, userId, userName, userEmail, requestId, source = null, idvVerificationId = null }) {
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
    static fromRequest(req) {
        return new SanctionsCheckRequestDto({
            name: req.query.name,
            limit: req.query.limit,
            fuzzy: req.query.fuzzy,
            schema: req.query.schema,
            country: req.query.country,
            organizationId: req.headers['x-org-id'],
            userId: req.headers['x-user-id'],
            userName: decodeHeader(req.headers['x-user-name']),
            userEmail: req.headers['x-user-email'],
            requestId: req.headers['x-request-id'] || `req-${Date.now()}`,
            ...SanctionsCheckRequestDto.sourceFromHeaders(req)
        });
    }
    /**
     * x-source / x-idv-verification-id come only from idv-service (api-gateway strips them from clients).
     * The verification id is trusted only together with x-source: idv.
     */
    static sourceFromHeaders(req) {
        if (req.headers['x-source'] === 'idv') {
            const verificationId = req.headers['x-idv-verification-id'];
            return { source: 'idv', idvVerificationId: verificationId && UUID_PATTERN.test(verificationId) ? verificationId : null };
        }
        const authType = req.headers['x-auth-type'];
        const source = authType === 'api-key' ? 'api' : authType === 'jwt' ? 'panel' : null;
        return { source, idvVerificationId: null };
    }
    isValid() {
        return !!(this.name && this.name.length > 0 && this.organizationId);
    }
}
export default SanctionsCheckRequestDto;
