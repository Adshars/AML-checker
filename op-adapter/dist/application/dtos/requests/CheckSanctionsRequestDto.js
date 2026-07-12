/**
 * CheckSanctionsRequestDto
 * Validates and normalizes incoming sanctions check request parameters.
 */
const DEFAULT_LIMIT = 15;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
export default class CheckSanctionsRequestDto {
    name;
    limit;
    fuzzy;
    schema;
    country;
    requestId;
    constructor({ name, limit, fuzzy, schema, country, requestId }) {
        this.name = name;
        this.limit = limit;
        this.fuzzy = fuzzy;
        this.schema = schema;
        this.country = country;
        this.requestId = requestId;
    }
    /**
     * Creates DTO from Express request object.
     * Performs validation and normalization of all parameters.
     * @throws {ValidationError} If required parameters are missing
     */
    static fromRequest(req) {
        const name = String(req.query.name ?? '').trim();
        if (!name) {
            throw new ValidationError('Missing name parameter');
        }
        const limitRaw = parseInt(String(req.query.limit ?? ''), 10);
        const limit = Number.isFinite(limitRaw)
            ? Math.min(Math.max(limitRaw, MIN_LIMIT), MAX_LIMIT)
            : DEFAULT_LIMIT;
        const fuzzy = toBoolean(req.query.fuzzy);
        const schema = req.query.schema ? String(req.query.schema).trim() || null : null;
        const country = req.query.country ? String(req.query.country).trim() || null : null;
        const requestIdHeader = req.headers['x-request-id'];
        const requestId = (Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader)
            || generateRequestId();
        return new CheckSanctionsRequestDto({
            name,
            limit,
            fuzzy,
            schema,
            country,
            requestId,
        });
    }
    /**
     * Returns search parameters for logging and response.
     */
    getSearchParams() {
        return {
            limit: this.limit,
            fuzzy: this.fuzzy,
            schema: this.schema,
            country: this.country,
        };
    }
    /**
     * Returns parameters for service layer call.
     */
    toServiceParams() {
        return {
            name: this.name,
            limit: this.limit,
            fuzzy: this.fuzzy,
            schema: this.schema,
            country: this.country,
            requestId: this.requestId,
        };
    }
}
/**
 * Converts string value to boolean.
 */
function toBoolean(value) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string')
        return value.toLowerCase() === 'true';
    return false;
}
/**
 * Generates unique request ID.
 */
function generateRequestId() {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
/**
 * Validation error for request DTOs.
 */
export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
