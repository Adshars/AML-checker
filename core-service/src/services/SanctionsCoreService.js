import sequelize from '../config/database.js';
import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';

export class AdapterError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'AdapterError';
    this.cause = cause;
  }
}

export default class SanctionsCoreService {
  constructor({ opAdapterClient }) {
    this.opAdapterClient = opAdapterClient;
  }

  async checkHealth() {
    let dbStatus = 'Disconnected';
    try {
      await sequelize.authenticate();
      dbStatus = 'Connected';
    } catch (error) {
      logger.warn('Health check DB connection failed', { error: error.message });
      dbStatus = 'Disconnected';
    }
    return { service: 'core-service', status: 'UP', database: dbStatus };
  }

  async checkSanctions({ name, limit, fuzzy, schema, country, orgID, userID, userEmail, requestId }) {
    let adapterResponse;
    let adapterLatency;

    try {
      const result = await this.opAdapterClient.checkSanctions({
        name,
        limit,
        fuzzy,
        schema,
        country,
        requestId,
      });
      adapterResponse = result.data;
      adapterLatency = result.duration;
    } catch (error) {
      const errorDetails = error.response?.data || error.message;
      logger.error('Error processing sanctions check', {
        requestId,
        error: error.message,
        details: errorDetails,
        stack: error.stack,
      });
      throw new AdapterError('Failed to query OP-Adapter', error);
    }

    const hits = adapterResponse.data || [];
    const hasHit = adapterResponse.hits_count > 0;

    const bestMatch = hits.length > 0 ? hits[0] : null;

    const joinArr = (arr) => (Array.isArray(arr) && arr.length > 0 ? arr.join(', ') : null);

    const getDescription = (match) => {
      if (!match) return null;
      const pos = joinArr(match.position) || '';
      const desc = joinArr(match.description) || joinArr(match.notes) || '';
      const combined = `${pos} ${desc}`.trim();
      return combined.length > 0 ? combined : null;
    };

    try {
      logger.debug('Creating AuditLog entry', {
        requestId,
        userId: userID,
        userEmail: userEmail,
        searchQuery: name,
        hasHit: hasHit,
      });
      await AuditLog.create({
        organizationId: orgID,
        userId: userID || 'API',
        userEmail: userEmail || null,
        searchQuery: name,
        hasHit: hasHit,
        hitsCount: adapterResponse.hits_count || 0,
        entityName: bestMatch?.name || null,
        entityScore: bestMatch?.score || null,
        entityBirthDate: bestMatch?.birthDate || null,
        entityGender: bestMatch?.gender || null,
        entityCountries: bestMatch ? joinArr(bestMatch.country) : null,
        entityDatasets: bestMatch ? joinArr(bestMatch.datasets) : null,
        entityDescription: getDescription(bestMatch),
        isSanctioned: bestMatch?.isSanctioned || false,
        isPep: bestMatch?.isPep || false,
      });
      logger.info('Audit log saved successfully', { requestId, orgID, hasHit, userEmail });
    } catch (dbError) {
      logger.error('Failed to save Audit Log', { requestId, error: dbError.message });
    }

    logger.info('Sanctions check completed', {
      requestId,
      orgID,
      result: hasHit ? 'HIT' : 'CLEAR',
      adapterLatency,
    });

    return adapterResponse;
  }
}
