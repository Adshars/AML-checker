import logger from '../../shared/logger/index.js';
import { SanctionsCheckRequestDto } from '../../application/dtos/requests/SanctionsCheckRequestDto.js';
import { ExternalServiceError } from '../../shared/errors/index.js';
/**
 * Sanctions Controller
 * Handles sanctions check endpoints
 */
export class SanctionsController {
    sanctionsCheckService;
    constructor(sanctionsCheckService) {
        this.sanctionsCheckService = sanctionsCheckService;
    }
    /**
     * Check sanctions
     * GET /check
     */
    checkSanctions = async (req, res) => {
        const requestDto = SanctionsCheckRequestDto.fromRequest(req);
        logger.info('Received sanctions check request', {
            requestId: requestDto.requestId,
            organizationId: requestDto.organizationId,
            userId: requestDto.userId,
            userEmail: requestDto.userEmail,
            queryName: requestDto.name
        });
        try {
            const responseData = await this.sanctionsCheckService.check(requestDto);
            res.json(responseData);
        }
        catch (error) {
            // Handle external service errors (from OpAdapterClient)
            const duckError = error;
            const isExternalError = error instanceof ExternalServiceError ||
                duckError.response !== undefined ||
                duckError.message?.includes('status code');
            if (isExternalError) {
                logger.error('Adapter error during sanctions check', {
                    requestId: requestDto.requestId,
                    error: duckError.message,
                    cause: duckError.originalError?.message || duckError.response?.data?.error
                });
                res.status(502).json({ error: 'Validation failed downstream' });
                return;
            }
            logger.error('Unexpected error during sanctions check', {
                requestId: requestDto.requestId,
                error: error instanceof Error ? error.message : String(error)
            });
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}
export default SanctionsController;
