import logger from '../../shared/logger/index.js';
import { HistoryQueryDto } from '../../application/dtos/requests/HistoryQueryDto.js';
import { buildHistoryCsv } from '../../application/services/HistoryCsvExporter.js';
const toDateOnly = (value) => value?.slice(0, 10);
const buildExportFilename = (queryDto) => {
    const start = toDateOnly(queryDto.startDate);
    const end = toDateOnly(queryDto.endDate);
    if (start && end)
        return `aml-history-${start}_${end}.csv`;
    if (start)
        return `aml-history-${start}.csv`;
    if (end)
        return `aml-history-${end}.csv`;
    return `aml-history-${new Date().toISOString().slice(0, 10)}.csv`;
};
/**
 * History Controller
 * Handles audit history endpoints
 */
export class HistoryController {
    auditService;
    constructor(auditService) {
        this.auditService = auditService;
    }
    /**
     * Get audit history
     * GET /history
     */
    getHistory = async (req, res) => {
        const requestId = req.headers['x-request-id'] || `hist-${Date.now()}`;
        const queryDto = HistoryQueryDto.fromRequest(req);
        logger.info('Fetching audit history', {
            requestId,
            organizationId: queryDto.organizationId || queryDto.orgId,
            page: queryDto.page,
            limit: queryDto.limit,
            filters: {
                search: queryDto.search,
                hasHit: queryDto.hasHit,
                userId: queryDto.userId
            }
        });
        try {
            const response = await this.auditService.getHistory(queryDto);
            res.json(response.toJSON());
        }
        catch (error) {
            logger.error('Database error retrieving history', {
                requestId,
                error: error instanceof Error ? error.message : String(error)
            });
            res.status(500).json({ error: 'Internal Server Error', requestId });
        }
    };
    /**
     * Export audit history as CSV
     * GET /history/export
     */
    exportHistory = async (req, res) => {
        const requestId = req.headers['x-request-id'] || `hist-export-${Date.now()}`;
        const queryDto = HistoryQueryDto.fromRequest(req);
        logger.info('Exporting audit history as CSV', {
            requestId,
            organizationId: queryDto.organizationId || queryDto.orgId,
            filters: {
                search: queryDto.search,
                hasHit: queryDto.hasHit,
                userId: queryDto.userId
            }
        });
        try {
            const logs = await this.auditService.exportHistory(queryDto);
            const csv = buildHistoryCsv(logs);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${buildExportFilename(queryDto)}"`);
            res.send(csv);
        }
        catch (error) {
            logger.error('Database error exporting history', {
                requestId,
                error: error instanceof Error ? error.message : String(error)
            });
            res.status(500).json({ error: 'Internal Server Error', requestId });
        }
    };
}
export default HistoryController;
