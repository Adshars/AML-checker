import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from './authMiddleware.js';

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
const TEST_URL = process.env.OP_ADAPTER_URL || 'http://op-adapter:3000';

// Middleware CORS (Frontend)
app.use(cors());

// Swagger config

const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Logging middleware
app.use((req, res, next) => {
    console.log(`[GATEWAY] ${req.method} ${req.url}`);
    next();
});

// PROXY SETUP

// Auth Service

const authProxy = createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
        // Forward organization ID and auth type headers if present
        if (req.headers['x-org-id']) {
            proxyReq.setHeader('x-org-id', req.headers['x-org-id']);
        }
        if (req.headers['x-user-id']) {
            proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
        }
        if (req.headers['x-role']) {
            proxyReq.setHeader('x-role', req.headers['x-role']);
        }
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
        // Forward organization ID and auth type headers if present
        if (req.headers['x-org-id']) 
            { proxyReq.setHeader('x-org-id', req.headers['x-org-id']);
        }
        if (req.headers['x-user-id']) 
            { proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
        }
        if (req.headers['x-role'])
            { proxyReq.setHeader('x-role', req.headers['x-role']);
        }
    }
});

// Routing

// Auth Service public routes

app.post('/auth/register-organization', authProxy);
app.post('/auth/register-user', authProxy);
app.post('/auth/login', authProxy);
app.post('/auth/internal/validate-api-key', authProxy);

// Auth Service protected routes

app.post('/auth/reset-secret', authMiddleware, authProxy);

// Core Service protected routes
app.use('/sanctions', authMiddleware, sanctionsProxy);


// Health Check
app.get('/health', (req, res) => {
    res.json({ service: 'api-gateway', status: 'UP' });
});

app.listen(PORT, () => {
    console.log(`[GATEWAY] API Gateway running on port ${PORT}`);
});
