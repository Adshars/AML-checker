import axios from 'axios';
import sequelize from '../config/database.js';
import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';

const OP_ADAPTER_URL = process.env.OP_ADAPTER_URL || 'http://op-adapter:3000';

// Health Check Handler
export const getHealth = async (req, res) => {
    let dbStatus = 'Disconnected';
    try {
        await sequelize.authenticate();
        dbStatus = 'Connected';
    } catch (error) {
        logger.warn('Health check DB connection failed', {error: error.message});
        dbStatus = 'Disconnected';
    }
    logger.debug('Health check requested', {dbStatus});
    res.json({ service: 'core-service', status: 'UP', database: dbStatus });
};


// Sanctions Check Handler (/check)
export const checkSanctions = async (req, res) => {
    const queryName = req.query.name;

    // Get context from the headers
    const orgID = req.headers['x-org-id'];
    const userID = req.headers['x-user-id'];

    const requestId = req.headers['x-request-id'] || `core-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info('Received sanctions check request', { requestId, orgID, userID, queryName });

    if (!queryName) {
        logger.warn('Validation failed: Missing name parameter', { requestId, orgID });
        return res.status(400).json({ error: 'Missing name parameter' });
    }

    if (!orgID) {
        logger.warn('Security alert: Missing Organization Context (x-org-id)', { requestId, ip: req.ip });
        return res.status(403).json({ error: 'Missing Organization Context (x-org-id)' });
    }

    try {
        // Forward the request to the OP Adapter
        logger.debug(`Forwarding check to OP-Adapter`, { requestId, query: queryName });

        const startAdapter = Date.now();
        const adapterResponse = await axios.get(`${OP_ADAPTER_URL}/check`, {
            params: { name: queryName },
            headers: { 'x-request-id': requestId }
        });
        const durationAdapter = Date.now() - startAdapter;
        logger.debug(`OP-Adapter response received in ${durationAdapter}ms`, { requestId });

        const data = adapterResponse.data;
        const hasHit = data.hits_count > 0;

        // Log the audit record
        try {
            await AuditLog.create({
                organizationId: orgID,
                userId: userID || 'B2B-API-KEY', // When no user ID, assume API key usage
                searchQuery: queryName,
                hasHit: hasHit,
                hitsCount: data.hits_count
            });
            logger.info('Audit log saved successfully', { requestId, orgID, hasHit });
        } catch (dbError) {
            logger.error('Failed to save Audit Log', { requestId, error: dbError.message });
        }
            logger.info('Sanctions check completed', { 
                requestId,
                orgID,
                result: hasHit ? 'HIT' : 'CLEAR' ,
                adapterLatency: durationAdapter
    });

        // Return the response from the adapter
        res.json(data);

    } catch (error) {
        const errorDetails = error.response?.data || error.message;
        logger.error('Error processing sanctions check', { 
            requestId, 
            error: error.message, 
            details: errorDetails,
            stack: error.stack 
        });

        res.status(502).json({ error: 'Validation failed downstream' });
    }


};