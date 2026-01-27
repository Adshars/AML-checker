import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import nock from 'nock';

const JWT_SECRET = 'test-jwt-secret';
const AUTH_URL = 'http://auth-service.test';
const CORE_URL = 'http://core-service.test';

// Helper to create a fresh app instance with env configured
const setupApp = async () => {
	process.env.NODE_ENV = 'test';
	process.env.JWT_SECRET = JWT_SECRET;
	process.env.AUTH_SERVICE_URL = AUTH_URL;
	process.env.CORE_SERVICE_URL = CORE_URL;

	// Re-import module to reset rate limiters between tests
	jest.resetModules();
	const { app } = await import('../src/index.js');
	return app;
};

// Disable real HTTP calls; allow supertest localhost
beforeAll(() => {
	nock.disableNetConnect();
	nock.enableNetConnect('127.0.0.1');
});

afterEach(() => {
	nock.cleanAll();
});

afterAll(() => {
	nock.enableNetConnect();
});

describe('API Gateway E2E', () => {

	test('Rate limiting: 101st request to /sanctions returns 429', async () => {
		const app = await setupApp();
		const token = jwt.sign({ userId: 'u1', organizationId: 'org1', role: 'user' }, JWT_SECRET);

		// Core service mock - match any /check request with any query
		nock(CORE_URL)
			.persist()
			.get(/\/check/)
			.reply(200, { ok: true });

		let lastResponse;
		for (let i = 1; i <= 101; i += 1) {
			const res = await request(app)
				.get('/sanctions/check')
				.query({ name: 'test' })
				.set('Authorization', `Bearer ${token}`);

			lastResponse = res;
		}

		expect(lastResponse.statusCode).toBe(429);
		expect(lastResponse.body.error).toMatch(/Too many requests/i);
	}, 20000);

	test('Routing: /auth/login is proxied to Auth Service', async () => {
		const app = await setupApp();

		nock(AUTH_URL)
			.post('/auth/login')
			.reply(200, { ok: 'auth' });

		const res = await request(app)
			.post('/auth/login')
			.send({ email: 'user@test.com', password: 'pass' });

		expect(res.statusCode).toBe(200);
		expect(res.body.ok).toBe('auth');
	});

		test('Routing: /auth/reset-password is proxied to Auth Service', async () => {
			const app = await setupApp();

			nock(AUTH_URL)
				.post('/auth/reset-password')
				.reply(200, { ok: 'reset' });

			const res = await request(app)
				.post('/auth/reset-password')
				.send({ token: 't1', password: 'NewPass123!' });

			expect(res.statusCode).toBe(200);
			expect(res.body.ok).toBe('reset');
		});

		test('Routing: /auth/refresh is proxied to Auth Service when authorized', async () => {
			const app = await setupApp();
			const token = jwt.sign({ userId: 'u1', organizationId: 'org1', role: 'user' }, JWT_SECRET);

			nock(AUTH_URL)
				.post('/auth/refresh')
				.reply(200, { ok: 'refresh' });

			const res = await request(app)
				.post('/auth/refresh')
				.set('Authorization', `Bearer ${token}`)
				.send({ refreshToken: 'r1' });

			expect(res.statusCode).toBe(200);
			expect(res.body.ok).toBe('refresh');
		});

	test('Routing: /sanctions/* is proxied to Core Service', async () => {
		const app = await setupApp();
		const token = jwt.sign({ userId: 'u1', organizationId: 'org1', role: 'user' }, JWT_SECRET);

		nock(CORE_URL)
			.get('/test')
			.reply(200, { ok: 'core' });

		const res = await request(app)
			.get('/sanctions/test')
			.set('Authorization', `Bearer ${token}`);

		expect(res.statusCode).toBe(200);
		expect(res.body.ok).toBe('core');
	});

	test('Routing: /auth/change-password is proxied to Auth Service', async () => {
		const app = await setupApp();
		const token = jwt.sign({ userId: 'u1', organizationId: 'org1', role: 'user' }, JWT_SECRET);

		nock(AUTH_URL)
			.post('/auth/change-password')
			.reply(200, { ok: 'password-changed' });

		const res = await request(app)
			.post('/auth/change-password')
			.set('Authorization', `Bearer ${token}`)
			.send({ currentPassword: 'old', newPassword: 'new' });

		expect(res.statusCode).toBe(200);
		expect(res.body.ok).toBe('password-changed');
	});

	test('Routing: /auth/forgot-password is proxied to Auth Service', async () => {
		const app = await setupApp();

		nock(AUTH_URL)
			.post('/auth/forgot-password')
			.reply(200, { ok: 'reset-link-sent' });

		const res = await request(app)
			.post('/auth/forgot-password')
			.send({ email: 'user@test.com' });

		expect(res.statusCode).toBe(200);
		expect(res.body.ok).toBe('reset-link-sent');
	});
});

describe('API Gateway - Authentication & Authorization', () => {
	
	test('Auth: Invalid JWT token returns 401', async () => {
		const app = await setupApp();
		
		const res = await request(app)
			.get('/sanctions/check')
			.query({ name: 'test' })
			.set('Authorization', 'Bearer invalid.token.here');
		
		expect(res.statusCode).toBe(401);
		expect(res.body.error).toMatch(/Unauthorized/i);
	});

	test('Auth: Missing Authorization header on protected route returns 401', async () => {
		const app = await setupApp();
		
		const res = await request(app)
			.get('/sanctions/check')
			.query({ name: 'test' });
		
		expect(res.statusCode).toBe(401);
		expect(res.body.error).toMatch(/Unauthorized/i);
	});

	test('Auth: Valid API Key and Secret passes authentication', async () => {
		const app = await setupApp();
		
		nock(AUTH_URL)
			.post('/auth/internal/validate-api-key')
			.reply(200, { valid: true, organizationId: 'org1' });
		
		nock(CORE_URL)
			.get('/test')
			.reply(200, { ok: 'core' });
		
		const res = await request(app)
			.get('/sanctions/test')
			.set('x-api-key', 'pk_live_test123')
			.set('x-api-secret', 'sk_live_secret456');
		
		expect(res.statusCode).toBe(200);
		expect(res.body.ok).toBe('core');
	});

	test('Auth: Invalid API Key returns 401', async () => {
		const app = await setupApp();
		
		nock(AUTH_URL)
			.post('/auth/internal/validate-api-key')
			.reply(401, { error: 'Invalid API Key' });
		
		const res = await request(app)
			.get('/sanctions/test')
			.set('x-api-key', 'invalid_key')
			.set('x-api-secret', 'invalid_secret');
		
		expect(res.statusCode).toBe(401);
	});
});

describe('API Gateway - Protected Routes Enforcement', () => {

	test('Protected: /auth/register-user requires authentication', async () => {
		const app = await setupApp();
		
		const res = await request(app)
			.post('/auth/register-user')
			.send({ email: 'test@test.com', password: 'pass' });
		
		expect(res.statusCode).toBe(401);
	});

	test('Protected: /auth/reset-secret requires authentication', async () => {
		const app = await setupApp();
		
		const res = await request(app)
			.post('/auth/reset-secret')
			.send({ password: 'mypassword' });
		
		expect(res.statusCode).toBe(401);
	});

	test('Protected: /auth/change-password requires authentication', async () => {
		const app = await setupApp();
		
		const res = await request(app)
			.post('/auth/change-password')
			.send({ currentPassword: 'old', newPassword: 'new' });
		
		expect(res.statusCode).toBe(401);
	});

	test('Protected: /sanctions/* requires authentication', async () => {
		const app = await setupApp();
		
		const res = await request(app)
			.get('/sanctions/check')
			.query({ name: 'test' });
		
		expect(res.statusCode).toBe(401);
	});

	test('Protected: /users/* requires authentication', async () => {
		const app = await setupApp();
		
		const res = await request(app)
			.get('/users');
		
		expect(res.statusCode).toBe(401);
	});
});

describe('API Gateway - CORS & Headers', () => {

	test('CORS: OPTIONS preflight request allowed without auth', async () => {
		const app = await setupApp();
		
		const res = await request(app)
			.options('/sanctions/check')
			.set('Origin', 'http://localhost:3000');
		
		expect(res.statusCode).toBe(204);
		expect(res.headers['access-control-allow-credentials']).toBe('true');
	});

	test('Headers: Auth context headers injected to proxy request', async () => {
		const app = await setupApp();
		const token = jwt.sign({ userId: 'u1', organizationId: 'org1', role: 'user' }, JWT_SECRET);
		
		let capturedHeaders = {};
		nock(CORE_URL)
			.get('/test')
			.reply(function() {
				capturedHeaders = this.req.headers;
				return [200, { ok: true }];
			});
		
		await request(app)
			.get('/sanctions/test')
			.set('Authorization', `Bearer ${token}`);
		
		expect(capturedHeaders['x-org-id']).toBe('org1');
		expect(capturedHeaders['x-user-id']).toBe('u1');
		expect(capturedHeaders['x-role']).toBe('user');
		expect(capturedHeaders['x-auth-type']).toBe('jwt');
	});
});

describe('API Gateway - Health Check', () => {

	test('Health: /health endpoint returns UP status', async () => {
		const app = await setupApp();
		
		const res = await request(app)
			.get('/health');
		
		expect(res.statusCode).toBe(200);
		expect(res.body.service).toBe('api-gateway');
		expect(res.body.status).toBe('UP');
	});

	test('Health: /health does not require authentication', async () => {
		const app = await setupApp();
		
		const res = await request(app)
			.get('/health');
		
		expect(res.statusCode).toBe(200);
	});
});

describe('API Gateway - Error Handling', () => {

	test('Error: Upstream service error is handled', async () => {
		const app = await setupApp();
		const token = jwt.sign({ userId: 'u1', organizationId: 'org1', role: 'user' }, JWT_SECRET);
		
		nock(CORE_URL)
			.get(/\/check/)
			.reply(500, { error: 'Internal Server Error' });
		
		const res = await request(app)
			.get('/sanctions/check')
			.query({ name: 'test' })
			.set('Authorization', `Bearer ${token}`);
		
		expect(res.statusCode).toBe(500);
	});
});
