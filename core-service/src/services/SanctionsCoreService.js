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

    // Helper to safely convert arrays to comma-separated strings
    const arrayToString = (val) => {
      if (!val) return null;
      if (Array.isArray(val)) return val.join(', ');
      return String(val);
    };

    // Get first result (bestHit)
    const bestHit = (hits && hits.length > 0) ? hits[0] : null;

    // Extract raw properties from adapter response
    // NOTE: Adapter now returns .properties field (after Stage 1 changes)
    // If it doesn't exist, use entire bestHit object as fallback
    const rawProps = bestHit ? (bestHit.properties || bestHit) : {};

    // Extract flags from properties.topics
    const isSanctioned = bestHit ? ((rawProps.topics || []).includes('sanction')) : false;
    const isPep = bestHit ? ((rawProps.topics || []).includes('role.pep')) : false;

    try {
      logger.debug('Creating AuditLog entry', {
        requestId,
        orgID,
        userID,
        userEmail,
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

        // Flat columns for quick table overview
        // Using arrayToString because OpenSanctions always returns arrays
        entityName: rawProps.name ? (Array.isArray(rawProps.name) ? rawProps.name[0] : rawProps.name) : (bestHit?.name || null),
        entityScore: bestHit?.score || null,
        entityBirthDate: arrayToString(rawProps.birthDate),
        entityGender: arrayToString(rawProps.gender),
        entityCountries: arrayToString(rawProps.country),
        entityDatasets: arrayToString(bestHit?.datasets),
        entityDescription: arrayToString(rawProps.description || rawProps.position || rawProps.notes),

        // Full data (key to success)
        // Store entire raw object. This way we get weakAlias, education, religion, etc. in DB
        hitDetails: rawProps,

        // Flags
        isSanctioned: isSanctioned,
        isPep: isPep,
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
