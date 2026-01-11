import jwt from 'jsonwebtoken';
import axios from 'axios';
import logger from './utils/logger.js';

// Adres Auth Service in Docker network

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';

// Auxiliary functions

const handleApiKeyAuth = async (req) => {
    const apiKey = req.headers['x-api-key'];
    const apiSecret = req.headers['x-api-secret'];

    if (!apiKey || !apiSecret) return null; // No API key/secret provided = not this auth method

    const maskedKey = `${apiKey.substring(0, 8)}...`;
    logger.debug(`Gateway API Key Auth Attempt`, { requestId: req.requestId, keyPrefix: maskedKey });

    try {
        const response = await axios.post(`${AUTH_SERVICE_URL}/auth/internal/validate-api-key`, {
            apiKey,
            apiSecret
        });

        if (response.data.valid) {
            return {
                orgId: response.data.organizationId,
                authType: 'api-key',
                userId: null,
                role: null
            };
        }
    } catch (error) {
        logger.warn('Gateway API Key Validation Failed', { requestId: req.requestId, error: error.message });
        throw new Error('Invalid API Key or Secret');
    }
    return null;
};
    const handleJwtAuth = (req) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) return null; // No token provided = not this auth method

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            logger.debug('Gateway JWT Verified', { requestId: req.requestId, userId: decoded.userId, orgId: decoded.organizationId });
            return {
                orgId: decoded.organizationId,
                userId: decoded.userId,
                role: decoded.role,
                authType: 'jwt',
            };
        } catch (error) {
            logger.warn('Gateway JWT Invalid', { requestId: req.requestId, error: error.message });
            throw new Error('Invalid or Expired token');
        }
    };

// Main Middleware Function

export const authMiddleware = async (req, res, next) => {
    try{

        try {
            // Try API Key Authentication first
            const apiAuth = await handleApiKeyAuth(req);
            if (apiAuth) {
                req.headers['x-org-id'] = apiAuth.orgId;
                req.headers['x-auth-type'] = apiAuth.authType;

                logger.info('Gateway Auth Success (API Key)', { requestId: req.requestId, orgId: apiAuth.orgId });
                return next();
            }
        } catch (error) {
            return res.status(403).json({ error: error.message });
        }
            // Try JWT Authentication next
        try {
            const jwtAuth = handleJwtAuth(req);
            if (jwtAuth) {
                req.headers['x-org-id'] = jwtAuth.orgId;
                req.headers['x-user-id'] = jwtAuth.userId;
                req.headers['x-role'] = jwtAuth.role;
                req.headers['x-auth-type'] = jwtAuth.authType;

                logger.info('Gateway Auth Success (JWT)', { requestId: req.requestId, userId: jwtAuth.userId });
                return next();
            }
        } catch (error) {
            return res.status(403).json({ error: error.message });
        }

        // If neither method authenticated
        logger.warn('Gateway Auth Missing Credentials', { requestId: req.requestId, ip: req.ip });
        return res.status(401).json({ error: 'Authentication required' });

    } catch (error) {
        logger.error('Gateway Auth Middleware Error', { requestId: req.requestId, error: error.message, stack: error.stack });
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};