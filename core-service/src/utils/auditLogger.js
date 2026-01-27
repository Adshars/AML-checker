import AuditLog from '../models/AuditLog.js';
import logger from './logger.js';

export default class AuditLogger {
  constructor({ auditLogModel }) {
    this.AuditLog = auditLogModel || AuditLog;
  }

  async logSearch(params) {
    const {
      searchQuery,
      organizationId,
      userId,
      userEmail,
      hasHit,
      entityName,
      entityDescription,
      entityDatasets,
      requestId,
    } = params;

    try {
      await this.AuditLog.create({
        organizationId: organizationId || null,
        userId: userId || null,
        userEmail: userEmail || null,
        action: 'SANCTIONS_CHECK',
        searchQuery,
        hasHit: hasHit || false,
        entityName,
        entityDescription,
        entityDatasets,
      });

      logger.debug('Search logged to AuditLog', {
        requestId,
        organizationId,
        userEmail,
        hasHit,
      });
    } catch (error) {
      logger.error('Failed to log search to AuditLog', {
        requestId,
        error: error.message,
        stack: error.stack,
      });
    }
  }
}
