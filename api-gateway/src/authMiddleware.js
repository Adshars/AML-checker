import jwt from 'jsonwebtoken';
import axios from 'axios';
import crypto from 'crypto';
import NodeCache from 'node-cache';
import logger from './utils/logger.js';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';

// SECURITY: Fail-fast if JWT_SECRET is not configured
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('SECURITY ERROR: JWT_SECRET environment variable is required. Application cannot start without it.');
}

export default class AuthMiddleware {
  constructor() {
    // Cache with 60 second TTL for API key validation
    this.apiKeyCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
    // Bind middleware method so 'this' context is preserved
    this.middleware = this.validate.bind(this);
  }

  /**
   * Validates API Key by checking cache first, then calling auth-service
   */
  async handleApiKeyAuth(req) {
    const apiKey = req.headers['x-api-key'];
    const apiSecret = req.headers['x-api-secret'];

    if (!apiKey || !apiSecret) return null;

    // SECURITY: Hash cache key to avoid storing secrets in plaintext
    const cacheKey = crypto.createHash('sha256').update(`${apiKey}:${apiSecret}`).digest('hex');

    // Check cache first (performance optimization)
    const cached = this.apiKeyCache.get(cacheKey);
    if (cached) {
      logger.debug('API Key Auth - Cache Hit', { requestId: req.requestId, orgId: cached.orgId });
      return cached;
    }

    // Cache miss - call auth service
    const maskedKey = `${apiKey.substring(0, 8)}...`;
    logger.debug('API Key Auth - Cache Miss, Validating', { requestId: req.requestId, keyPrefix: maskedKey });

    try {
      const response = await axios.post(`${AUTH_SERVICE_URL}/auth/internal/validate-api-key`, {
        apiKey,
        apiSecret
      }, { timeout: 2000 });

      if (response.data.valid) {
        const result = {
          orgId: response.data.organizationId,
          authType: 'api-key',
          userId: null,
          email: null,
          role: null
        };

        // Cache the result
        this.apiKeyCache.set(cacheKey, result);
        logger.debug('API Key Auth - Cached', { requestId: req.requestId, orgId: result.orgId });

        return result;
      }
    } catch (error) {
      logger.warn('API Key Validation Failed', { requestId: req.requestId, error: error.message });
      throw new Error('Invalid API Key or Secret');
    }

    return null;
  }

  /**
   * Validates JWT token
   */
  handleJwtAuth(req) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return null;

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      logger.debug('JWT Verified', { requestId: req.requestId, userId: decoded.userId, orgId: decoded.organizationId, email: decoded.email });
      return {
        orgId: decoded.organizationId,
        authType: 'jwt',
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        userName: decoded.firstName && decoded.lastName ? `${decoded.firstName} ${decoded.lastName}` : (decoded.email || 'User')
      };
    } catch (error) {
      logger.warn('JWT Verification Failed', { requestId: req.requestId, error: error.message });
      throw new Error('Invalid or expired JWT token');
    }
  }

  /**
   * Main middleware - tries API Key auth first, then JWT
   * Attaches auth context to BOTH req.auth (for code reference) and req.headers (for proxy forwarding)
   */
  async validate(req, res, next) {
    // FIX: Allow CORS Preflight requests to pass without auth
    if (req.method === 'OPTIONS') {
      return next();
    }

    try {
      req.requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Try API Key auth first
      let authResult = await this.handleApiKeyAuth(req);
      if (authResult) {
        req.auth = authResult;
        // CRITICAL: Attach to req.headers for proxy forwarding
        req.headers['x-org-id'] = authResult.orgId;
        req.headers['x-auth-type'] = authResult.authType;
        req.headers['x-user-email'] = 'api@system';
        if (authResult.userId) req.headers['x-user-id'] = authResult.userId;
        if (authResult.role) req.headers['x-role'] = authResult.role;
        
        logger.info('Auth Success', { requestId: req.requestId, authType: 'api-key', orgId: authResult.orgId });
        return next();
      }

      // Try JWT auth
      authResult = this.handleJwtAuth(req);
      if (authResult) {
        req.auth = authResult;
        // CRITICAL: Attach to req.headers for proxy forwarding
        req.headers['x-org-id'] = authResult.orgId;
        req.headers['x-auth-type'] = authResult.authType;
        if (authResult.email) req.headers['x-user-email'] = authResult.email;
        if (authResult.userId) req.headers['x-user-id'] = authResult.userId;
        if (authResult.role) req.headers['x-role'] = authResult.role;
        if (authResult.userName) req.headers['x-user-name'] = authResult.userName;
        
        logger.info('Auth Success', { requestId: req.requestId, authType: 'jwt', userId: authResult.userId });
        return next();
      }

      // No valid auth found
      logger.warn('Auth Failed - No Valid Credentials', { requestId: req.requestId });
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid credentials' });
    } catch (error) {
      logger.error('Auth Error', { requestId: req.requestId, error: error.message });
      return res.status(401).json({ error: 'Unauthorized: ' + error.message });
    }
  }
}