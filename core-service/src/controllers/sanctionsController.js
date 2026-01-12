import axios from 'axios';
import sequelize from '../config/database.js';
import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';
import { response } from 'express';

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
    const { name, limit, fuzzy, schema, country } = req.query;
    const queryName = name;

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

    logger.info('Received sanctions check request', { requestId, orgID, userID, queryName });

    try {
        // Forward the request to the OP Adapter
        logger.debug(`Forwarding check to OP-Adapter`, { requestId, query: queryName });

        const startAdapter = Date.now();

        const adapterResponse = await axios.get(`${OP_ADAPTER_URL}/check`, {
            params: { 
                name: queryName, 
                limit, 
                fuzzy, 
                schema, 
                country },
            headers: { 'x-request-id': requestId }
        });
        const durationAdapter = Date.now() - startAdapter;
        logger.debug(`OP-Adapter response received in ${durationAdapter}ms`, { requestId });

        const responseData = adapterResponse.data;
        const hits = responseData.data || [];
        const hasHit = responseData.hits_count > 0;

        // Prepare detailed match information for save

        // Chosting top match
        let bestMatch = null;
        if (hits.length > 0) {
            bestMatch = hits[0]; // First item is best match
        }

        const joinArr = (arr) => (Array.isArray(arr) && arr.length > 0 ? arr.join(', ') : null);

        // Helper: Combines description and position into one text
        const getDescription = (match) => {
            if (!match) return null;
            const pos = joinArr(match.position) || '';
            const desc = joinArr(match.description) || ''; // Op-adapter returns this as 'description' or 'notes'
            const combined = `${pos} ${desc}`.trim();
            return combined.length > 0 ? combined : null; 
        };


        // Save the audit record
        try {
            await AuditLog.create({
                organizationId: orgID,
                userId: userID || 'API',
                searchQuery: queryName,
                hasHit: hasHit,
                hitsCount: responseData.hits_count || 0,

                // Mapping best match details
                entityName: bestMatch?.name || null,
                entityScore: bestMatch?.score || null,
                entityBirthDate: bestMatch?.birthDate || null,
                entityGender: bestMatch?.gender || null,
                
                entityCountries: bestMatch ? joinArr(bestMatch.country) : null,
                entityDatasets: bestMatch ? joinArr(bestMatch.datasets) : null,
                entityDescription: getDescription(bestMatch),

                isSanctioned: bestMatch?.isSanctioned || false,
                isPep: bestMatch?.isPep || false
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
        res.json(responseData);

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