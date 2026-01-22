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
});
