import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from './authMiddleware.js';
import logger from './utils/logger.js';
import rateLimit from 'express-rate-limit';

dotenv.config();

// Swagger setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Configuration

// Microservice addresses (from Docker network)
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';
const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://core-service:3000';

// Temporary OP Adapter service address
// const TEST_URL = process.env.OP_ADAPTER_URL || 'http://op-adapter:3000';

// Middleware CORS (Frontend)
app.use(cors());

// Swagger config

const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Logging middleware
app.use((req, res, next) => {
    req.requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; 
    logger.info(`Gateway received request`, { 
        method: req.method, 
        url: req.url, 
        requestId: req.requestId,
        ip: req.ip || req.connection.remoteAddress
    });
    next();
});

// Rate Limiting
// 10 request per 15 minutes per IP
const authLimiter = rateLimit({
    windowsMS: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Limit for API routes
// 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
    windowsMS: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// PROXY SETUP

// Helper function to inject headers
const injectProxyHeaders = (proxyReq, req) => {

    proxyReq.setHeader('x-request-id', req.requestId);

    if (req.headers['x-org-id']) proxyReq.setHeader('x-org-id', req.headers['x-org-id']);
    if (req.headers['x-user-id']) proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
    if (req.headers['x-role']) proxyReq.setHeader('x-role', req.headers['x-role']);
};

// Auth Service

const authProxy = createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
        injectProxyHeaders(proxyReq, req);

        logger.debug(`Proxying to Auth Service`, { requestId: req.requestId, url: req.url });
    },
    onError: (err, req, res) => {
        logger.error(`Auth Proxy Error`, { requestId: req.requestId, error: err.message });
        res.status(502).json({ error: 'Auth Service Unavailable' });
    }
});

// Core Service

const sanctionsProxy = createProxyMiddleware({
    target: CORE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/sanctions': '', // Remove /sanctions prefix when forwarding
    },
    onProxyReq: (proxyReq, req, res) => {
        injectProxyHeaders(proxyReq, req);
        logger.debug(`Proxying to Core Service`, { requestId: req.requestId, url: req.url });
    },
    onError: (err, req, res) => {
        logger.error(`Core Proxy Error`, { requestId: req.requestId, error: err.message });
        res.status(502).json({ error: 'Core Service Unavailable' });
    }
});

// Routing

// Auth Service public routes

app.post('/auth/register-organization', authLimiter, authProxy);
app.post('/auth/register-user', authLimiter, authProxy);
app.post('/auth/login', authLimiter, authProxy);
app.post('/auth/internal/validate-api-key', authProxy);
app.post('/auth/forgot-password', authLimiter, authProxy);
app.post('/auth/reset-password', authLimiter, authProxy);
app.post('/auth/refresh', authProxy);
app.post('/auth/logout', authProxy);

// Auth Service protected routes

app.post('/auth/reset-secret', authMiddleware, authProxy);

// Core Service protected routes
app.use('/sanctions', authMiddleware, apiLimiter, sanctionsProxy);


// Health Check
app.get('/health', (req, res) => {
    res.json({ service: 'api-gateway', status: 'UP' });
});

app.listen(PORT, () => {
  logger.info(`API Gateway running`, { port: PORT, env: process.env.NODE_ENV || 'development' });
});