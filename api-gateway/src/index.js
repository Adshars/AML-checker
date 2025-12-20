import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotnv from 'dotenv';

dotnv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Configuration

// Microservice addresses (from Docker network)
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';
const OP_ADAPTER_URL = process.env.OP_ADAPTER_URL || 'http://op-adapter:3000';

// Middleware CORS (Frontend)
app.use(cors());

// Logging middleware
app.use((reg, res, next) => {
    console.log('[GATEWAY] ${reg.method} ${reg.method} ${reg.path}');
    next();
});

// ROUTING (PROXY)

// Auth Service

app.use('/auth', createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {

    }
}));

// OP Adapter Service

app.use('/sanctions', createProxyMiddleware({
    target: OP_ADAPTER_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/sanctions': '',
    }
}));

// Health Check
app.get('/health', (req, res) => {
    res.json({ service: 'api-gateway', status: 'UP' });
});

app.listen(PORT, () => {
    console.log(`[GATEWAY] API Gateway running on port ${PORT}`);
});
