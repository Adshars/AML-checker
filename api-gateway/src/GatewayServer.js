import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import AuthMiddleware from './authMiddleware.js';
import logger from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class GatewayServer {
  constructor(port = 8080) {
    this.app = express();
    this.port = port;
    this.authMiddleware = new AuthMiddleware();

    // Initialize all setup methods
    this.setupGlobalMiddleware();
    this.setupRateLimiters();
    this.setupProxies();
    this.setupRoutes();
  }

  /**
   * Global middleware: CORS, logging, Swagger
   */
  setupGlobalMiddleware() {
    // SECURITY: Whitelist allowed origins (configure via ALLOWED_ORIGINS env variable)
    const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost', 'http://localhost:80', 'http://localhost:3000', 'http://localhost:5173'];

    const corsOptions = {
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, Postman)
        if (!origin) {
          return callback(null, true);
        }
        if (ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        logger.warn('CORS: Blocked request from unauthorized origin', { origin });
        return callback(new Error(`CORS: Origin ${origin} not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-api-secret', 'x-org-id', 'x-user-id', 'x-role'],
      optionsSuccessStatus: 204,
    };

    this.app.use(cors(corsOptions));

    // Swagger setup
    const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    // Request logging middleware
    this.app.use((req, res, next) => {
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      req.requestId = requestId;

      logger.info('Incoming Request', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        path: req.path,
        ip: req.ip || req.connection.remoteAddress,
      });

      next();
    });

    // Health check endpoint (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({ service: 'api-gateway', status: 'UP' });
    });
  }

  /**
   * Setup rate limiters
   */
  setupRateLimiters() {
    this.authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20,
      message: { error: 'Too many auth requests from this IP, please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
    });

    this.apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: { error: 'Too many requests from this IP, please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  /**
   * Setup proxy middleware
   */
  setupProxies() {
    const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';
    const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://core-service:3000';

    // Helper function to inject headers from request to proxy request
    const injectHeaders = (proxyReq, req) => {
      // Inject request tracking ID
      if (req.requestId) {
        proxyReq.setHeader('x-request-id', req.requestId);
      }

      // CRITICAL: Inject auth context headers (set by AuthMiddleware)
      // These are required by upstream services to identify the organization, user, and role
      if (req.headers['x-org-id']) {
        proxyReq.setHeader('x-org-id', req.headers['x-org-id']);
      }
      if (req.headers['x-user-id']) {
        proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
      }
      if (req.headers['x-role']) {
        proxyReq.setHeader('x-role', req.headers['x-role']);
      }
      if (req.headers['x-auth-type']) {
        proxyReq.setHeader('x-auth-type', req.headers['x-auth-type']);
      }
    };

    this.authProxy = createProxyMiddleware({
      target: AUTH_SERVICE_URL,
      changeOrigin: true,
      pathRewrite: { '^/auth': '/auth' },
      onProxyReq: (proxyReq, req) => {
        injectHeaders(proxyReq, req);
        logger.debug('Proxying to Auth Service', { requestId: req.requestId, path: req.path });
      },
      onError: (err, req, res) => {
        logger.error('Auth Service Proxy Error', { requestId: req.requestId, error: err.message });
        if (!res.headersSent) {
          res.status(502).json({ error: 'Authentication service unavailable' });
        }
      },
    });

    this.sanctionsProxy = createProxyMiddleware({
      target: CORE_SERVICE_URL,
      changeOrigin: true,
      pathRewrite: { '^/sanctions': '' },
      onProxyReq: (proxyReq, req) => {
        injectHeaders(proxyReq, req);
        logger.debug('Proxying to Sanctions Service', { requestId: req.requestId, path: req.path });
      },
      onError: (err, req, res) => {
        logger.error('Sanctions Service Proxy Error', { requestId: req.requestId, error: err.message });
        if (!res.headersSent) {
          res.status(502).json({ error: 'Sanctions service unavailable' });
        }
      },
    });

    // Users Management Proxy
    this.usersProxy = createProxyMiddleware({
      target: AUTH_SERVICE_URL,
      changeOrigin: true,
      // Express strips the "/users" prefix when hitting this proxy; map it back
      pathRewrite: (path) => path.replace(/^\//, '/users/'),
      onProxyReq: (proxyReq, req) => {
        injectHeaders(proxyReq, req);
        logger.debug('Proxying to Users Management', { requestId: req.requestId, path: req.path });
      },
      onError: (err, req, res) => {
        logger.error('Users Management Proxy Error', { requestId: req.requestId, error: err.message });
        if (!res.headersSent) {
          res.status(502).json({ error: 'Users management service unavailable' });
        }
      },
    });
  }

  /**
   * Setup explicit routes in correct order:
   * 1. Protected Auth Routes (must be BEFORE public /auth wildcard)
   * 2. Public Auth Routes
   * 3. Protected Sanctions Routes
   */
  setupRoutes() {
    // ==================== PROTECTED AUTH ROUTES ====================
    // Auth REQUIRED - rate limited

    this.app.post('/auth/register-organization',
      this.authLimiter,
      this.authMiddleware.middleware,  // ✅ REQUIRE AUTHENTICATION (SuperAdmin only)
      this.authProxy
    );

    this.app.post('/auth/register-user',
      this.authLimiter,
      this.authMiddleware.middleware,  // ✅ REQUIRE AUTHENTICATION
      this.authProxy
    );

    this.app.post('/auth/reset-secret',
      this.authLimiter,
      this.authMiddleware.middleware,
      this.authProxy
    );

    this.app.post('/auth/change-password',
      this.authLimiter,
      this.authMiddleware.middleware,
      this.authProxy
    );

    this.app.get('/auth/organization/keys',
      this.authLimiter,
      this.authMiddleware.middleware,
      this.authProxy
    );

    // ==================== PUBLIC AUTH ROUTES ====================
    // No auth required, rate limited

    this.app.post('/auth/login',
      this.authLimiter,
      this.authProxy
    );

    this.app.post('/auth/forgot-password',
      this.authLimiter,
      this.authProxy
    );

    this.app.post('/auth/reset-password',
      this.authLimiter,
      this.authProxy
    );

    this.app.post('/auth/refresh',
      this.authLimiter,
      this.authProxy
    );

    this.app.post('/auth/logout',
      this.authLimiter,
      this.authProxy
    );

    // ==================== PROTECTED SANCTIONS ROUTES ====================
    // Auth required, stricter rate limit

    this.app.use('/sanctions',
      this.authMiddleware.middleware,
      this.apiLimiter,
      this.sanctionsProxy
    );

    // ==================== PROTECTED USERS MANAGEMENT ROUTES ====================
    // Auth required (admin only), rate limited

    this.app.use('/users',
      this.authMiddleware.middleware,
      this.apiLimiter,
      this.usersProxy
    );

    logger.info('All routes configured', {
      protectedAuthRoutes: ['/register-organization', '/register-user', '/reset-secret', '/change-password', '/organization/keys'],
      publicAuthRoutes: ['/login', '/forgot-password', '/reset-password', '/refresh', '/logout'],
      protectedSanctionsRoutes: ['/sanctions (wildcard)'],
      protectedUsersRoutes: ['/users (wildcard)'],
    });
  }

  /**
   * Start the Express server
   */
  start() {
    if (process.env.NODE_ENV !== 'test') {
      this.app.listen(this.port, () => {
        logger.info('API Gateway started', {
          port: this.port,
          env: process.env.NODE_ENV || 'development',
        });
      });
    }
    return this.app;
  }
}
