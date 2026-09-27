import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import nock from 'nock';
import express, { type Application, type Request, type Response, type NextFunction } from 'express';

const JWT_SECRET = 'test-jwt-secret';
const AUTH_URL = 'http://auth-service.test';
const CORE_URL = 'http://core-service.test';
const CLOSED_PORT_URL = 'http://127.0.0.1:1';

// Fresh app instance (resets rate limiters and API key cache)
const setupApp = async (overrides: Record<string, string> = {}): Promise<Application> => {
	process.env.NODE_ENV = 'test';
	process.env.JWT_SECRET = JWT_SECRET;
	process.env.AUTH_SERVICE_URL = overrides.AUTH_SERVICE_URL ?? AUTH_URL;
	process.env.CORE_SERVICE_URL = overrides.CORE_SERVICE_URL ?? CORE_URL;

	jest.resetModules();
	const { app } = await import('../src/index.js');
	return app;
};

const signToken = (payload: Record<string, unknown>) => jwt.sign(payload, JWT_SECRET);

// Capture headers received by core-service for a single request
const captureCoreHeaders = (path: string | RegExp = /\/check/) => {
	const captured: { headers: Record<string, unknown> } = { headers: {} };
	nock(CORE_URL)
		.get(path)
		.query(true)
		.reply(function() {
			captured.headers = this.req.headers;
			return [200, { ok: true }];
		});
	return captured;
};

const mockApiKeyValidation = (body: Record<string, unknown>) =>
	nock(AUTH_URL)
		.post('/auth/internal/validate-api-key')
		.reply(200, { valid: true, organizationId: 'org1', ...body });

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

describe('Internal header stripping', () => {

	test('stripInternalHeaders removes every internal header', async () => {
		const { INTERNAL_HEADERS, stripInternalHeaders } = await import('../src/config/internalHeaders.js');
		const headers: Record<string, string> = { authorization: 'Bearer x', 'x-api-key': 'pk' };
		INTERNAL_HEADERS.forEach(header => { headers[header] = 'spoofed'; });
		const next = jest.fn();

		stripInternalHeaders({ headers } as unknown as Request, {} as Response, next as unknown as NextFunction);

		INTERNAL_HEADERS.forEach(header => expect(headers[header]).toBeUndefined());
		expect(headers.authorization).toBe('Bearer x');
		expect(headers['x-api-key']).toBe('pk');
		expect(next).toHaveBeenCalled();
	});

	test('API key request cannot spoof user, role or organization headers', async () => {
		const app = await setupApp();
		mockApiKeyValidation({ organizationName: 'Acme', services: { sanctions: true, identityMode: 'NONE' } });
		const captured = captureCoreHeaders();

		const res = await request(app)
			.get('/sanctions/check')
			.query({ name: 'test' })
			.set('x-api-key', 'pk_live_test123')
			.set('x-api-secret', 'sk_live_secret456')
			.set('x-user-id', 'evil')
			.set('x-role', 'admin')
			.set('x-user-name', 'Evil User')
			.set('x-org-id', 'other')
			.set('x-org-sanctions', 'true');

		expect(res.statusCode).toBe(200);
		expect(captured.headers['x-user-id']).toBeUndefined();
		expect(captured.headers['x-role']).toBeUndefined();
		expect(captured.headers['x-user-name']).toBeUndefined();
		expect(captured.headers['x-org-id']).toBe('org1');
		expect(captured.headers['x-auth-type']).toBe('api-key');
	});

	test('spoofed headers are stripped on public routes too', async () => {
		const app = await setupApp();
		let captured: Record<string, unknown> = {};
		nock(AUTH_URL)
			.post('/auth/login')
			.reply(function() {
				captured = this.req.headers;
				return [200, { ok: true }];
			});

		await request(app)
			.post('/auth/login')
			.set('x-role', 'superadmin')
			.set('x-org-id', 'other')
			.send({ email: 'a@b.pl', password: 'x' });

		expect(captured['x-role']).toBeUndefined();
		expect(captured['x-org-id']).toBeUndefined();
	});

	test('client x-request-id is replaced by the gateway request id', async () => {
		const app = await setupApp();
		const captured = captureCoreHeaders();

		await request(app)
			.get('/sanctions/check')
			.query({ name: 'test' })
			.set('Authorization', `Bearer ${signToken({ userId: 'u1', organizationId: 'org1', role: 'user' })}`)
			.set('x-request-id', 'client-supplied');

		expect(captured.headers['x-request-id']).toMatch(/^req-/);
	});

	test('CORS no longer allows internal headers from browsers', async () => {
		const app = await setupApp();

		const res = await request(app)
			.options('/sanctions/check')
			.set('Origin', 'http://localhost:3000')
			.set('Access-Control-Request-Method', 'GET');

		const allowed = String(res.headers['access-control-allow-headers']).toLowerCase();
		expect(allowed).toContain('authorization');
		expect(allowed).toContain('x-api-key');
		expect(allowed).not.toContain('x-user-id');
		expect(allowed).not.toContain('x-role');
		expect(allowed).not.toContain('x-org-id');
	});
});

describe('Organization service headers', () => {

	test('JWT services and URL-encoded organization name are forwarded', async () => {
		const app = await setupApp();
		const captured = captureCoreHeaders();
		const token = signToken({
			userId: 'u1',
			organizationId: 'org1',
			role: 'admin',
			organizationName: 'Zażółć Sp. z o.o.',
			services: { sanctions: true, identityMode: 'FULL_AML' }
		});

		const res = await request(app)
			.get('/sanctions/check')
			.query({ name: 'test' })
			.set('Authorization', `Bearer ${token}`);

		expect(res.statusCode).toBe(200);
		expect(captured.headers['x-org-sanctions']).toBe('true');
		expect(captured.headers['x-org-identity-mode']).toBe('FULL_AML');
		expect(captured.headers['x-org-name']).toBe(encodeURIComponent('Zażółć Sp. z o.o.'));
		expect(decodeURIComponent(captured.headers['x-org-name'] as string)).toBe('Zażółć Sp. z o.o.');
	});

	test('legacy JWT without services is allowed with default services', async () => {
		const app = await setupApp();
		const captured = captureCoreHeaders();

		const res = await request(app)
			.get('/sanctions/check')
			.query({ name: 'test' })
			.set('Authorization', `Bearer ${signToken({ userId: 'u1', organizationId: 'org1', role: 'user' })}`);

		expect(res.statusCode).toBe(200);
		expect(captured.headers['x-org-sanctions']).toBe('true');
		expect(captured.headers['x-org-identity-mode']).toBe('NONE');
		expect(captured.headers['x-org-name']).toBeUndefined();
	});

	test('API key organization name and services are forwarded', async () => {
		const app = await setupApp();
		mockApiKeyValidation({ organizationName: 'Łódź Trade', services: { sanctions: true, identityMode: 'IDENTITY' } });
		const captured = captureCoreHeaders();

		await request(app)
			.get('/sanctions/check')
			.query({ name: 'test' })
			.set('x-api-key', 'pk_live_test123')
			.set('x-api-secret', 'sk_live_secret456');

		expect(decodeURIComponent(captured.headers['x-org-name'] as string)).toBe('Łódź Trade');
		expect(captured.headers['x-org-identity-mode']).toBe('IDENTITY');
	});

	test('API key response without services falls back to defaults', async () => {
		const app = await setupApp();
		mockApiKeyValidation({});
		const captured = captureCoreHeaders();

		const res = await request(app)
			.get('/sanctions/check')
			.query({ name: 'test' })
			.set('x-api-key', 'pk_live_test123')
			.set('x-api-secret', 'sk_live_secret456');

		expect(res.statusCode).toBe(200);
		expect(captured.headers['x-org-sanctions']).toBe('true');
		expect(captured.headers['x-org-identity-mode']).toBe('NONE');
	});
});

describe('Sanctions service enforcement', () => {

	test('JWT with sanctions disabled -> 403', async () => {
		const app = await setupApp();
		const core = nock(CORE_URL).get(/.*/).query(true).reply(200, { ok: true });
		const token = signToken({
			userId: 'u1',
			organizationId: 'org1',
			role: 'admin',
			services: { sanctions: false, identityMode: 'IDENTITY' }
		});

		const res = await request(app)
			.get('/sanctions/check')
			.query({ name: 'test' })
			.set('Authorization', `Bearer ${token}`);

		expect(res.statusCode).toBe(403);
		expect(res.body).toEqual({ error: 'Service not enabled for organization', service: 'sanctions' });
		expect(core.isDone()).toBe(false);
	});

	test('API key with sanctions disabled -> 403', async () => {
		const app = await setupApp();
		mockApiKeyValidation({ services: { sanctions: false, identityMode: 'FULL_AML' } });

		const res = await request(app)
			.get('/sanctions/check')
			.query({ name: 'test' })
			.set('x-api-key', 'pk_live_test123')
			.set('x-api-secret', 'sk_live_secret456');

		expect(res.statusCode).toBe(403);
		expect(res.body).toEqual({ error: 'Service not enabled for organization', service: 'sanctions' });
	});

	test('other /sanctions/* routes are guarded as well', async () => {
		const app = await setupApp();
		const token = signToken({ userId: 'u1', organizationId: 'org1', role: 'admin', services: { sanctions: false, identityMode: 'IDENTITY' } });

		const res = await request(app)
			.get('/sanctions/history')
			.set('Authorization', `Bearer ${token}`);

		expect(res.statusCode).toBe(403);
	});
});

describe('requireService middleware', () => {

	const buildApp = async (service: 'sanctions' | 'identity', auth?: Record<string, unknown>) => {
		const { requireService } = await import('../src/serviceGuard.js');
		const app = express();
		app.use((req, _res, next) => {
			if (auth) req.auth = auth as never;
			next();
		});
		app.get('/protected', requireService(service), (_req, res) => { res.json({ ok: true }); });
		return app;
	};

	const authWith = (services: Record<string, unknown>) => ({ orgId: 'org1', authType: 'jwt', services });

	test('identity: NONE -> 403', async () => {
		const app = await buildApp('identity', authWith({ sanctions: true, identityMode: 'NONE' }));

		const res = await request(app).get('/protected');

		expect(res.statusCode).toBe(403);
		expect(res.body).toEqual({ error: 'Service not enabled for organization', service: 'identity' });
	});

	test.each([['IDENTITY'], ['FULL_AML']])('identity: %s -> next', async (identityMode) => {
		const app = await buildApp('identity', authWith({ sanctions: false, identityMode }));

		const res = await request(app).get('/protected');

		expect(res.statusCode).toBe(200);
		expect(res.body.ok).toBe(true);
	});

	test('sanctions: enabled -> next', async () => {
		const app = await buildApp('sanctions', authWith({ sanctions: true, identityMode: 'NONE' }));

		const res = await request(app).get('/protected');

		expect(res.statusCode).toBe(200);
	});

	test('missing auth context -> 401', async () => {
		const app = await buildApp('identity');

		const res = await request(app).get('/protected');

		expect(res.statusCode).toBe(401);
	});
});

describe('SuperAdmin organization routes', () => {

	const superadminToken = () => signToken({ userId: 'sa1', organizationId: 'org0', role: 'superadmin' });

	test.each([
		['get', '/auth/organizations'],
		['get', '/auth/organizations/64b000000000000000000001'],
		['put', '/auth/organizations/64b000000000000000000001/services']
	])('%s %s without token -> 401', async (method, path) => {
		const app = await setupApp();

		const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](path);

		expect(res.statusCode).toBe(401);
	});

	test('GET /auth/organizations is proxied with query and role header', async () => {
		const app = await setupApp();
		let captured: Record<string, unknown> = {};
		nock(AUTH_URL)
			.get('/auth/organizations')
			.query({ search: 'acme', page: '2' })
			.reply(function() {
				captured = this.req.headers;
				return [200, { data: [], meta: { page: 2 } }];
			});

		const res = await request(app)
			.get('/auth/organizations')
			.query({ search: 'acme', page: 2 })
			.set('Authorization', `Bearer ${superadminToken()}`);

		expect(res.statusCode).toBe(200);
		expect(res.body.meta.page).toBe(2);
		expect(captured['x-role']).toBe('superadmin');
		expect(captured['x-user-id']).toBe('sa1');
	});

	test('GET /auth/organizations/:id is proxied', async () => {
		const app = await setupApp();
		nock(AUTH_URL)
			.get('/auth/organizations/64b000000000000000000001')
			.reply(200, { id: '64b000000000000000000001' });

		const res = await request(app)
			.get('/auth/organizations/64b000000000000000000001')
			.set('Authorization', `Bearer ${superadminToken()}`);

		expect(res.statusCode).toBe(200);
		expect(res.body.id).toBe('64b000000000000000000001');
	});

	test('PUT /auth/organizations/:id/services is proxied with body', async () => {
		const app = await setupApp();
		const body = { sanctions: false, identityMode: 'IDENTITY' };
		nock(AUTH_URL)
			.put('/auth/organizations/64b000000000000000000001/services', body)
			.reply(200, { services: body });

		const res = await request(app)
			.put('/auth/organizations/64b000000000000000000001/services')
			.set('Authorization', `Bearer ${superadminToken()}`)
			.send(body);

		expect(res.statusCode).toBe(200);
		expect(res.body.services).toEqual(body);
	});
});

describe('Proxy error handling', () => {

	test('unreachable sanctions service -> 502 with custom message', async () => {
		const app = await setupApp({ CORE_SERVICE_URL: CLOSED_PORT_URL });

		const res = await request(app)
			.get('/sanctions/check')
			.query({ name: 'test' })
			.set('Authorization', `Bearer ${signToken({ userId: 'u1', organizationId: 'org1', role: 'user' })}`);

		expect(res.statusCode).toBe(502);
		expect(res.body).toEqual({ error: 'Sanctions service unavailable' });
	});

	test('unreachable auth service -> 502 with custom message', async () => {
		const app = await setupApp({ AUTH_SERVICE_URL: CLOSED_PORT_URL });

		const res = await request(app)
			.post('/auth/login')
			.send({ email: 'a@b.pl', password: 'x' });

		expect(res.statusCode).toBe(502);
		expect(res.body).toEqual({ error: 'Authentication service unavailable' });
	});

	test('x-request-id reaches the downstream service', async () => {
		const app = await setupApp();
		const captured = captureCoreHeaders();

		await request(app)
			.get('/sanctions/check')
			.query({ name: 'test' })
			.set('Authorization', `Bearer ${signToken({ userId: 'u1', organizationId: 'org1', role: 'user' })}`);

		expect(captured.headers['x-request-id']).toEqual(expect.stringMatching(/^req-\d+-/));
	});
});
