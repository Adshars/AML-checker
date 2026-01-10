import jwt from 'jsonwebtoken';
import axios from 'axios';

// Adres Auth Service in Docker network

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';

export const authMiddleware = async (req, res, next) => {
    try {
        
        // SCENARIO: Login with API Key (System to System communication)

        const apiKey = req.headers['x-api-key'];
        const apiSecret = req.headers['x-api-secret'];

        if (apiKey && apiSecret) {

            console.log('[DEBUG] API Key Auth Attempt');
            console.log(`[DEBUG] API Key: ${apiKey}`);
            console.log(`[DEBUG] API Secret (length): ${apiSecret.length}`);
            try {
                // Validate API Key and Secret with Auth Service
                const response = await axios.post(`${AUTH_SERVICE_URL}/auth/internal/validate-api-key`, {
                    apiKey,
                    apiSecret
                });

                console.log('[DEBUG] API Key Validation Response:', response.data);

                if (response.data.valid) {

                    // Success Orgazation ID in request for downstream services

                    req.headers['x-org-id'] = response.data.organizationId;
                    req.headers['x-auth-type'] = 'api-key';

                    return next();
                }
            } catch (err) {
                console.error('API Key Validation Failed:', err.response ? err.response.data : err.message);
                return res.status(403).json({ error: 'Invalid API Key or Secret' });
            }
        }

        // SCENARIO: Login with JWT (User authentication)

        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {

            try {

                // Verify JWT
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                console.log('Decoded JWT:', decoded);

                // Success - Attach user info to request for downstream services

                if (decoded.organizationId) {
                    req.headers['x-org-id'] = decoded.organizationId;
                } else {
                    console.warn('JWT missing organization ID');
                }

                if (decoded.userId) {
                    req.headers['x-user-id'] = decoded.userId;
                }

                if (decoded.role) {
                    req.headers['x-role'] = decoded.role;
                }

                req.headers['x-auth-type'] = 'jwt';

                return next();
            } catch (err) {
                console.error('JWT Error:', err.message);
                return res.status(403).json({ error: 'Invalid or Expired token' });
            }
        }

        // SCENARIO: No valid authentication provided

        return res.status(401).json({ error: 'Authentication required' });

    } catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
    };