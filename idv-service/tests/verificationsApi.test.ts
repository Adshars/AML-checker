import { jest } from '@jest/globals';
import crypto from 'crypto';
import { createInMemoryModel, type Row } from './helpers/inMemoryModel.js';

const { rows, model: mockModel } = createInMemoryModel();

jest.unstable_mockModule('../src/infrastructure/database/sequelize/models/VerificationModel.js', () => ({
  createVerificationModel: () => mockModel
}));

jest.unstable_mockModule('../src/infrastructure/database/sequelize/connection.js', () => ({
  SequelizeConnection: class {
    async connect() {}
    async disconnect() {}
    getSequelize() {
      return { sync: jest.fn() };
    }
    async isHealthy() { return true; }
  }
}));

jest.unstable_mockModule('../src/shared/logger/index.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const STORAGE_KEY = crypto.randomBytes(32).toString('hex');

jest.unstable_mockModule('../src/shared/config/index.js', () => ({
  config: {
    database: {},
    provider: 'fake',
    coreService: { url: 'http://core-service.test' },
    publicBaseUrl: 'http://localhost',
    storage: { dir: '/tmp', key: STORAGE_KEY },
    verification: { linkTtlHours: 72, sessionTtlMinutes: 60 },
    port: 3000
  }
}));

const request = (await import('supertest')).default;
const { Application } = await import('../src/app.js');

let app: import('express').Application;
beforeAll(async () => {
  const application = new Application();
  await application.initialize();
  app = application.getApp();
});

beforeEach(() => {
  rows.length = 0;
  jest.clearAllMocks();
});

// Headers as set by api-gateway
const apiKey = (orgId = 'org-1', identityMode = 'FULL_AML') => ({
  'x-org-id': orgId,
  'x-org-name': encodeURIComponent('Zażółć Sp. z o.o.'),
  'x-org-identity-mode': identityMode,
  'x-auth-type': 'api-key'
});

const jwt = (orgId = 'org-1', identityMode = 'FULL_AML', role = 'user') => ({
  'x-org-id': orgId,
  'x-org-name': encodeURIComponent('Zażółć Sp. z o.o.'),
  'x-org-identity-mode': identityMode,
  'x-auth-type': 'jwt',
  'x-user-id': 'user-1',
  'x-user-name': encodeURIComponent('Łukasz Kowalski'),
  'x-role': role
});

const createVerification = async (headers = apiKey(), body: Row = { externalRef: 'CUST-1', customerName: 'Jan Testowy' }) =>
  request(app).post('/verifications').set(headers).send(body);

describe('POST /verifications', () => {
  test('API key -> 201 with a verification link; only the token hash is stored', async () => {
    const res = await createVerification();

    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      identityMode: 'FULL_AML',
      isDemo: false,
      externalRef: 'CUST-1',
      customerName: 'Jan Testowy'
    });
    expect(res.body.verificationUrl).toMatch(/^http:\/\/localhost\/verify\/[A-Za-z0-9_-]{43}$/);

    const token = res.body.verificationUrl.split('/').pop();
    const stored = rows[0];
    expect(stored.tokenHash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored.organizationId).toBe('org-1');
    expect(stored.organizationName).toBe('Zażółć Sp. z o.o.');
    expect(stored.createdByType).toBe('API');
    expect(stored.screeningStatus).toBe('PENDING');
  });

  test('link expires after 72 h', async () => {
    const before = Date.now();
    const res = await createVerification();
    const expiresIn = new Date(res.body.linkExpiresAt).getTime() - before;

    expect(expiresIn).toBeGreaterThanOrEqual(72 * 60 * 60 * 1000 - 1000);
    expect(expiresIn).toBeLessThanOrEqual(72 * 60 * 60 * 1000 + 1000);
  });

  test('all fields are optional', async () => {
    const res = await createVerification(apiKey(), {});
    expect(res.statusCode).toBe(201);
    expect(res.body.externalRef).toBeNull();
  });

  test('JWT -> 403 FORBIDDEN_AUTH_TYPE', async () => {
    const res = await createVerification(jwt());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_AUTH_TYPE');
    expect(rows).toHaveLength(0);
  });

  test('identityMode NONE -> 403 SERVICE_NOT_ENABLED', async () => {
    const res = await createVerification(apiKey('org-1', 'NONE'));
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('SERVICE_NOT_ENABLED');
  });

  test('missing organization context -> 401', async () => {
    const res = await request(app).post('/verifications').set({ 'x-auth-type': 'api-key' }).send({});
    expect(res.statusCode).toBe(401);
  });

  test.each([
    ['http://client.example/done'],
    ['ftp://client.example/done'],
    ['not a url'],
    [`https://client.example/${'a'.repeat(2000)}`]
  ])('invalid redirectUrl %s -> 400 VALIDATION_ERROR', async (redirectUrl) => {
    const res = await createVerification(apiKey(), { redirectUrl });
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test.each([['https://client.example/kyc/done'], ['http://localhost:3000/done']])('valid redirectUrl %s', async (redirectUrl) => {
    const res = await createVerification(apiKey(), { redirectUrl });
    expect(res.statusCode).toBe(201);
  });

  test('too long externalRef / customerName and unknown fields -> 400', async () => {
    expect((await createVerification(apiKey(), { externalRef: 'x'.repeat(101) })).statusCode).toBe(400);
    expect((await createVerification(apiKey(), { customerName: 'x'.repeat(201) })).statusCode).toBe(400);
    expect((await createVerification(apiKey(), { status: 'VERIFIED' })).statusCode).toBe(400);
  });
});

describe('POST /verifications/demo', () => {
  test('JWT -> 201 demo created by the user', async () => {
    const res = await request(app).post('/verifications/demo').set(jwt());

    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ isDemo: true, customerName: 'Łukasz Kowalski', status: 'PENDING' });
    expect(res.body.verificationUrl).toMatch(/\/verify\//);
    expect(rows[0]).toMatchObject({ createdByType: 'USER', createdByUserId: 'user-1', createdByName: 'Łukasz Kowalski' });
  });

  test('API key -> 403 FORBIDDEN_AUTH_TYPE', async () => {
    const res = await request(app).post('/verifications/demo').set(apiKey());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_AUTH_TYPE');
  });
});

describe('Superadmin', () => {
  test.each([
    ['get', '/verifications'],
    ['post', '/verifications/demo'],
    ['get', '/verifications/11111111-1111-4111-8111-111111111111']
  ] as const)('%s %s -> 403 SUPERADMIN_FORBIDDEN', async (method, path) => {
    const res = await request(app)[method](path).set(jwt('org-1', 'FULL_AML', 'superadmin'));
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('SUPERADMIN_FORBIDDEN');
  });
});

describe('GET /verifications', () => {
  test('lists only the caller organization with History-style meta', async () => {
    await createVerification(apiKey('org-1'));
    await createVerification(apiKey('org-1'));
    await createVerification(apiKey('org-2'));

    const res = await request(app).get('/verifications').query({ page: 1, limit: 1 }).set(jwt('org-1'));

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ totalItems: 2, totalPages: 2, currentPage: 1, itemsPerPage: 1 });
    expect(mockModel.findAndCountAll.mock.calls[0][0].where).toMatchObject({ organizationId: 'org-1' });
    expect(res.body.data[0]).not.toHaveProperty('tokenHash');
    expect(res.body.data[0]).not.toHaveProperty('verificationUrl');
  });

  test('includeDemo=false filters demo verifications out', async () => {
    await request(app).post('/verifications/demo').set(jwt());
    await createVerification();

    const res = await request(app).get('/verifications').query({ includeDemo: 'false' }).set(jwt());

    expect(res.body.meta.totalItems).toBe(1);
    expect(res.body.data[0].isDemo).toBe(false);
  });

  test('status filter is passed to the query', async () => {
    await request(app).get('/verifications').query({ status: 'MANUAL_REVIEW' }).set(apiKey());
    expect(mockModel.findAndCountAll.mock.calls[0][0].where).toMatchObject({ status: 'MANUAL_REVIEW' });
  });

  test.each([
    [{ status: 'DONE' }],
    [{ limit: '101' }],
    [{ page: '0' }],
    [{ from: 'yesterday' }],
    [{ includeDemo: 'maybe' }]
  ])('invalid query %p -> 400', async (query) => {
    const res = await request(app).get('/verifications').query(query).set(apiKey());
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /verifications/:id', () => {
  test('returns details with the link while PENDING', async () => {
    const created = await createVerification();

    const res = await request(app).get(`/verifications/${created.body.id}`).set(apiKey());

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      id: created.body.id,
      status: 'PENDING',
      verificationUrl: created.body.verificationUrl,
      document: null,
      checks: null,
      attempts: { document: 0, selfie: 0 },
      decision: { source: null, reviewedBy: null },
      screening: { status: 'PENDING', hitsCount: null },
      images: { document: false, selfie: false, purgedAt: null },
      createdBy: { type: 'API', userId: null, name: null }
    });
  });

  test('another organization -> 404 (no enumeration)', async () => {
    const created = await createVerification(apiKey('org-1'));

    const res = await request(app).get(`/verifications/${created.body.id}`).set(apiKey('org-2'));

    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('malformed id -> 404', async () => {
    const res = await request(app).get('/verifications/not-a-uuid').set(apiKey());
    expect(res.statusCode).toBe(404);
  });

  test('expired PENDING link is expired lazily and the link is hidden', async () => {
    const created = await createVerification();
    rows[0].linkExpiresAt = new Date(Date.now() - 1000);

    const res = await request(app).get(`/verifications/${created.body.id}`).set(apiKey());

    expect(res.body.status).toBe('EXPIRED');
    expect(res.body.verificationUrl).toBeNull();
    expect(rows[0].tokenEncrypted).toBeNull();
  });

  test('link cannot be shown when encrypted with another key', async () => {
    const created = await createVerification();
    rows[0].tokenEncrypted = Buffer.alloc(40).toString('base64');

    const res = await request(app).get(`/verifications/${created.body.id}`).set(apiKey());

    expect(res.statusCode).toBe(200);
    expect(res.body.verificationUrl).toBeNull();
  });
});

describe('POST /verifications/:id/review', () => {
  const inReview = async () => {
    const created = await createVerification();
    Object.assign(rows[0], { status: 'MANUAL_REVIEW', decisionSource: 'AUTO', decisionReason: 'SCREENING_HIT' });
    return created.body.id as string;
  };

  test('APPROVE records who decided', async () => {
    const id = await inReview();

    const res = await request(app).post(`/verifications/${id}/review`).set(jwt()).send({ decision: 'APPROVE' });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('VERIFIED');
    expect(res.body.decision).toMatchObject({
      source: 'MANUAL',
      reason: 'SCREENING_HIT',
      reviewedBy: { id: 'user-1', name: 'Łukasz Kowalski' },
      comment: null
    });
    expect(res.body.decision.reviewedAt).toBeTruthy();
  });

  test('REJECT with a comment', async () => {
    const id = await inReview();

    const res = await request(app).post(`/verifications/${id}/review`).set(jwt()).send({ decision: 'REJECT', comment: 'Sanctioned person' });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('REJECTED');
    expect(rows[0].reviewComment).toBe('Sanctioned person');
  });

  test.each([[{ decision: 'REJECT' }], [{ decision: 'REJECT', comment: 'ab' }], [{ decision: 'MAYBE' }], [{}]])(
    'invalid body %p -> 400', async (body) => {
      const id = await inReview();
      const res = await request(app).post(`/verifications/${id}/review`).set(jwt()).send(body);
      expect(res.statusCode).toBe(400);
      expect(rows[0].status).toBe('MANUAL_REVIEW');
    });

  test('outside MANUAL_REVIEW -> 409 INVALID_STATE', async () => {
    const created = await createVerification();

    const res = await request(app).post(`/verifications/${created.body.id}/review`).set(jwt()).send({ decision: 'APPROVE' });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('INVALID_STATE');
  });

  test('API key -> 403 FORBIDDEN_AUTH_TYPE', async () => {
    const id = await inReview();
    const res = await request(app).post(`/verifications/${id}/review`).set(apiKey()).send({ decision: 'APPROVE' });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_AUTH_TYPE');
  });

  test('another organization -> 404', async () => {
    const id = await inReview();
    const res = await request(app).post(`/verifications/${id}/review`).set(jwt('org-2')).send({ decision: 'APPROVE' });
    expect(res.statusCode).toBe(404);
  });
});

describe('Health and errors', () => {
  test('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toEqual({ service: 'idv-service', status: 'UP', provider: 'fake', db: true });
  });

  test('malformed JSON -> 400', async () => {
    const res = await request(app).post('/verifications').set(apiKey()).set('Content-Type', 'application/json').send('{bad');
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('unknown route -> 404 NOT_FOUND', async () => {
    const res = await request(app).get('/nope');
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
