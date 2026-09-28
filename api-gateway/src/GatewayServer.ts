import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors, { type CorsOptions } from 'cors';
import { createProxyMiddleware, type Options as ProxyOptions, type RequestHandler as ProxyRequestHandler } from 'http-proxy-middleware';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { ClientRequest } from 'http';
import AuthMiddleware from './authMiddleware.js';
import { requireService } from './serviceGuard.js';
import { INTERNAL_HEADERS, stripInternalHeaders } from './config/internalHeaders.js';
import logger from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class GatewayServer {
  app: Application;
  port: number;
  authMiddleware: AuthMiddleware;
  authLimiter!: RateLimitRequestHandler;
  apiLimiter!: RateLimitRequestHandler;
  authProxy!: ProxyRequestHandler<Request, Response>;
  sanctionsProxy!: ProxyRequestHandler<Request, Response>;
  usersProxy!: ProxyRequestHandler<Request, Response>;
  idvProxy!: ProxyRequestHandler<Request, Response>;

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
   * Global middleware: header stripping, CORS, logging, Swagger
   */
  setupGlobalMiddleware(): void {
    // SECURITY: Must run first - downstream services trust internal x-* headers
    this.app.use(stripInternalHeaders);

    // SECURITY: Whitelist allowed origins (configure via ALLOWED_ORIGINS env variable)
    const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost', 'http://localhost:80', 'http://localhost:3000', 'http://localhost:5173'];

    const corsOptions: CorsOptions = {
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, Postman)
        if (!origin) {
          callback(null, true);
          return;
        }
        if (ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }
        logger.warn('CORS: Blocked request from unauthorized origin', { origin });
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-api-secret'],
      exposedHeaders: ['Content-Disposition'],
      optionsSuccessStatus: 204,
    };

    this.app.use(cors(corsOptions));

    // Swagger setup
    const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      req.requestId = requestId;

      logger.info('Incoming Request', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        path: req.path,
        ip: req.ip || req.socket.remoteAddress,
      });

      next();
    });

    // Health check endpoint (no auth required)
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ service: 'api-gateway', status: 'UP' });
    });
  }

  /**
   * Setup rate limiters
   */
  setupRateLimiters(): void {
    this.authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 200,
      message: { error: 'Too many auth requests from this IP, please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
    });

    this.apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 200,
      message: { error: 'Too many requests from this IP, please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  /**
   * Setup proxy middleware
   */
  setupProxies(): void {
    const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';
    const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://core-service:3000';
    const IDV_SERVICE_URL = process.env.IDV_SERVICE_URL || 'http://idv-service:3000';

    // Forward auth context headers (set by AuthMiddleware) and the request tracking ID.
    // Client-supplied copies were already removed by stripInternalHeaders.
    const injectHeaders = (proxyReq: ClientRequest, req: Request) => {
      if (req.requestId) {
        proxyReq.setHeader('x-request-id', req.requestId);
      }

      for (const header of INTERNAL_HEADERS) {
        const value = req.headers[header];
        if (header !== 'x-request-id' && value) {
          proxyReq.setHeader(header, value);
        }
      }
    };

    const createServiceProxy = (
      serviceName: string,
      unavailableMessage: string,
      options: Pick<ProxyOptions<Request, Response>, 'target' | 'pathRewrite' | 'cookieDomainRewrite' | 'proxyTimeout' | 'timeout'>
    ): ProxyRequestHandler<Request, Response> => createProxyMiddleware<Request, Response>({
      ...options,
      changeOrigin: true,
      on: {
        proxyReq: (proxyReq, req) => {
          injectHeaders(proxyReq, req);
          logger.debug(`Proxying to ${serviceName}`, { requestId: req.requestId, path: req.path });
        },
        error: (err, req, res) => {
          logger.error(`${serviceName} Proxy Error`, { requestId: req.requestId, error: err.message });
          // WebSocket upgrades hand over a raw socket instead of a response
          if (!('status' in res)) {
            res.destroy();
            return;
          }
          if (!res.headersSent) {
            res.status(502).json({ error: unavailableMessage });
          }
        },
      },
    });

    this.authProxy = createServiceProxy('Auth Service', 'Authentication service unavailable', {
      target: AUTH_SERVICE_URL,
      pathRewrite: { '^/auth': '/auth' },
      cookieDomainRewrite: '',
    });

    this.sanctionsProxy = createServiceProxy('Sanctions Service', 'Sanctions service unavailable', {
      target: CORE_SERVICE_URL,
      pathRewrite: { '^/sanctions': '' },
    });

    // Users Management Proxy
    this.usersProxy = createServiceProxy('Users Management', 'Users management service unavailable', {
      target: AUTH_SERVICE_URL,
      // Express strips the "/users" prefix when hitting this proxy; map it back
      pathRewrite: (path: string) => path.replace(/^\//, '/users/'),
    });

    // Identity verification (authenticated routes)
    this.idvProxy = createServiceProxy('IDV Service', 'Identity verification service unavailable', {
      target: IDV_SERVICE_URL,
      pathRewrite: { '^/idv': '' },
      proxyTimeout: 30000,
    });
  }

  /**
   * Setup explicit routes in correct order:
   * 1. Protected Auth Routes (must be BEFORE public /auth wildcard)
   * 2. Public Auth Routes
   * 3. Protected Sanctions Routes
   */
  setupRoutes(): void {
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
      this.apiLimiter,
      this.authMiddleware.middleware,
      this.authProxy
    );

    // SuperAdmin organization management (role enforced by auth-service)
    this.app.get('/auth/organizations',
      this.apiLimiter,
      this.authMiddleware.middleware,
      this.authProxy
    );

    this.app.get('/auth/organizations/:id',
      this.apiLimiter,
      this.authMiddleware.middleware,
      this.authProxy
    );

    this.app.put('/auth/organizations/:id/services',
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
      requireService('sanctions'),
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

    // ==================== PROTECTED IDENTITY VERIFICATION ROUTES ====================
    // Auth required (API key or JWT) and identity verification enabled for the organization.
    // Which endpoints accept API keys vs user sessions is enforced by idv-service.

    this.app.use('/idv',
      this.authMiddleware.middleware,
      requireService('identity'),
      this.apiLimiter,
      this.idvProxy
    );

    logger.info('All routes configured', {
      protectedAuthRoutes: [
        '/register-organization', '/register-user', '/reset-secret', '/change-password', '/organization/keys',
        '/organizations', '/organizations/:id', '/organizations/:id/services'
      ],
      publicAuthRoutes: ['/login', '/forgot-password', '/reset-password', '/refresh', '/logout'],
      protectedSanctionsRoutes: ['/sanctions (wildcard)'],
      protectedUsersRoutes: ['/users (wildcard)'],
      protectedIdvRoutes: ['/idv (wildcard)'],
    });
  }

  /**
   * Start the Express server
   */
  start(): Application {
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
