import { AuditLog } from '../../domain/entities/AuditLog.js';
import logger from '../../shared/logger/index.js';
/**
 * Sanctions Check Service
 * Handles sanctions screening business logic
 */
export class SanctionsCheckService {
    opAdapterClient;
    auditLogRepository;
    constructor(opAdapterClient, auditLogRepository) {
        this.opAdapterClient = opAdapterClient;
        this.auditLogRepository = auditLogRepository;
    }
    /**
     * Perform sanctions check
     */
    async check(requestDto) {
        const { name, limit, fuzzy, schema, country, organizationId, userId, userName, userEmail, requestId, source, idvVerificationId } = requestDto;
        // Call OP Adapter
        const result = await this.opAdapterClient.checkSanctions({
            name: name,
            limit,
            fuzzy,
            schema,
            country,
            requestId
        });
        const adapterResponse = result.data;
        const adapterLatency = result.duration;
        // Create audit log (non-blocking failure)
        let audit = null;
        try {
            const auditLog = AuditLog.fromCheckResult({
                organizationId: organizationId,
                userId: userId || 'API',
                userName: userName || (userId ? 'User' : 'API'),
                userEmail,
                searchQuery: name,
                adapterResponse,
                source,
                idvVerificationId
            });
            const saved = await this.auditLogRepository.create(auditLog);
            if (saved?.id) {
                audit = {
                    id: saved.id,
                    hasHit: saved.hasHit,
                    isSanctioned: saved.isSanctioned,
                    isPep: saved.isPep,
                    entityName: saved.entityName,
                    entityScore: saved.entityScore
                };
            }
            logger.info('Audit log saved successfully', {
                requestId,
                organizationId,
                hasHit: auditLog.hasHit,
                source,
                userEmail
            });
        }
        catch (dbError) {
            logger.error('Failed to save Audit Log', {
                requestId,
                error: dbError instanceof Error ? dbError.message : String(dbError)
            });
            // Continue - don't fail the request
        }
        logger.info('Sanctions check completed', {
            requestId,
            organizationId,
            result: (adapterResponse.hits_count ?? 0) > 0 ? 'HIT' : 'CLEAR',
            adapterLatency
        });
        return { ...adapterResponse, audit };
    }
}
export default SanctionsCheckService;
