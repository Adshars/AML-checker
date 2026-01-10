import jwt from 'jsonwebtoken';
import axios from 'axios';

// Adres Auth Service in Docker network

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';

// Auxiliary functions

const handleApiKeyAuth = async (req) => {
    const apiKey = req.headers['x-api-key'];
    const apiSecret = req.headers['x-api-secret'];

    if (!apiKey || !apiSecret) return null; // No API key/secret provided = not this auth method

    console.log(`[DEBUG] API Key Auth Attempt: ${apiKey}`);

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
        console.error('API Key Validation Failed:', error.message);
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
            console.log('Decoded JWT:', decoded);
            return {
                orgId: decoded.organizationId,
                userId: decoded.userId,
                role: decoded.role,
                authType: 'jwt',
            };
        } catch (error) {
            console.error('JWT Error:', error.message);
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
                return next();
            }
        } catch (error) {
            return res.status(403).json({ error: error.message });
        }

        // If neither method authenticated
        return res.status(401).json({ error: 'Authentication required' });

    } catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};