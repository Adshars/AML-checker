import { jest } from '@jest/globals';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createInMemoryModel } from './helpers/inMemoryModel.js';

const { rows, model: mockModel } = createInMemoryModel();
const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'idv-public-'));
const STORAGE_KEY = crypto.randomBytes(32).toString('hex');

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

jest.unstable_mockModule('../src/shared/config/index.js', () => ({
  config: {
    database: {},
    provider: 'fake',
    publicBaseUrl: 'http://localhost',
    storage: { dir: STORAGE_DIR, key: STORAGE_KEY },
    verification: {
      linkTtlHours: 72,
      sessionTtlMinutes: 60,
      imageRetentionDays: 14,
      maxDocumentAttempts: 3,
      maxSelfieAttempts: 3
    },
    port: 3000
  }
}));

const request = (await import('supertest')).default;
const { Application } = await import('../src/app.js');
const { FakeIdentityProvider } = await import('../src/infrastructure/providers/FakeIdentityProvider.js');
const { ScreeningService } = await import('../src/application/services/ScreeningService.js');
const { ProviderUnavailableError } = await import('../src/shared/errors/index.js');

let app: import('express').Application;
beforeAll(async () => {
  const application = new Application();
  await application.initialize();
  app = application.getApp();
});

afterAll(() => {
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  rows.length = 0;
  jest.restoreAllMocks();
});

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(256)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(256)]);

const apiKey = (identityMode = 'IDENTITY', orgId = 'org-1') => ({
  'x-org-id': orgId,
  'x-org-name': encodeURIComponent('Zażółć Sp. z o.o.'),
  'x-org-identity-mode': identityMode,
  'x-auth-type': 'api-key'
});

const createLink = async (body: Record<string, unknown> = {}, identityMode = 'IDENTITY') => {
  const res = await request(app).post('/verifications').set(apiKey(identityMode)).send({ customerName: 'Jan Testowy', ...body });
  const token = String(res.body.verificationUrl).split('/').pop() as string;
  return { id: res.body.id as string, token };
};

const session = (token: string) => `/public/sessions/${token}`;
const start = (token: string) => request(app).post(`${session(token)}/start`).send({ consent: true });
const uploadDocument = (token: string, file = JPEG, name = 'id.jpg') =>
  request(app).post(`${session(token)}/document`).attach('document', file, name);
const uploadSelfie = (token: string, file = JPEG) =>
  request(app).post(`${session(token)}/selfie`).attach('selfie', file, 'selfie.jpg');

const stored = (id: string) => rows.find((row) => row.id === id) as Record<string, any>;

describe('Happy path (IDENTITY)', () => {
  test('consent → document → selfie → VERIFIED; the customer never sees the result', async () => {
    const { id, token } = await createLink({ redirectUrl: 'https://client.example/done' });

    const initial = await request(app).get(session(token));
    expect(initial.statusCode).toBe(200);
    expect(initial.body).toMatchObject({
      organizationName: 'Zażółć Sp. z o.o.',
      status: 'PENDING',
      step: 'CONSENT',
      documentAttemptsLeft: 3,
      selfieAttemptsLeft: 3
    });

    const started = await start(token).set('X-Forwarded-For', '198.51.100.7, 203.0.113.9');
    expect(started.statusCode).toBe(200);
    expect(started.body.step).toBe('DOCUMENT');
    expect(stored(id)).toMatchObject({ status: 'IN_PROGRESS', consentIp: '203.0.113.9', tokenEncrypted: null });

    expect((await request(app).get(session(token))).body.step).toBe('DOCUMENT');

    const document = await uploadDocument(token);
    expect(document.statusCode).toBe(200);
    expect(document.body).toEqual({ step: 'SELFIE' });
    expect((await request(app).get(session(token))).body.step).toBe('SELFIE');

    const selfie = await uploadSelfie(token, PNG);
    expect(selfie.statusCode).toBe(200);
    expect(selfie.body).toEqual({ step: 'DONE', redirectUrl: 'https://client.example/done' });

    expect(stored(id)).toMatchObject({
      status: 'VERIFIED',
      decisionSource: 'AUTO',
      providerOutcome: 'VERIFIED',
      documentAttempts: 1,
      selfieAttempts: 1,
      livenessPassed: true,
      livenessScore: 0.95,
      faceMatchPassed: true,
      faceMatchScore: 0.9,
      documentImageMime: 'image/jpeg',
      selfieImageMime: 'image/png',
      screeningStatus: 'NOT_APPLICABLE',
      lockedUntil: null
    });
    expect(stored(id).ocr.fullName).toBe('Jan Testowy');
    expect(stored(id).providerVerificationIds).toHaveLength(1);
    expect(new Date(stored(id).completedAt).getTime()).toBeGreaterThan(0);
  });

  test('images are stored encrypted', async () => {
    const { id, token } = await createLink();
    await start(token);
    await uploadDocument(token);

    const file = path.join(STORAGE_DIR, stored(id).documentImagePath);
    const onDisk = fs.readFileSync(file);
    expect(onDisk.length).toBe(JPEG.length + 28);
    expect(onDisk.includes(JPEG.subarray(4, 64))).toBe(false);
  });

  test('completed link -> 410 ALREADY_COMPLETED everywhere', async () => {
    const { token } = await createLink();
    await start(token);
    await uploadDocument(token);
    await uploadSelfie(token);

    for (const res of [await request(app).get(session(token)), await start(token), await uploadSelfie(token)]) {
      expect(res.statusCode).toBe(410);
      expect(res.body.code).toBe('ALREADY_COMPLETED');
    }
  });

  test('provider manual review / rejection become the final status', async () => {
    const review = await createLink({ customerName: 'Anna [fake:review]' });
    await start(review.token);
    await uploadDocument(review.token);
    await uploadSelfie(review.token);
    expect(stored(review.id)).toMatchObject({ status: 'MANUAL_REVIEW', decisionReason: 'PROVIDER_REVIEW' });
    expect(stored(review.id).ocr.fullName).toBe('Anna');

    const reject = await createLink({ customerName: '[fake:reject]' });
    await start(reject.token);
    await uploadDocument(reject.token);
    const res = await uploadSelfie(reject.token);
    expect(res.body.step).toBe('DONE');
    expect(stored(reject.id)).toMatchObject({ status: 'REJECTED', decisionReason: 'FACE_MISMATCH', faceMatchPassed: false });
  });
});

describe('FULL_AML', () => {
  test('selfie result goes to the screening service', async () => {
    const run = jest.spyOn(ScreeningService.prototype, 'run');
    const { id, token } = await createLink({}, 'FULL_AML');
    await start(token);
    await uploadDocument(token);
    await uploadSelfie(token);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toMatchObject({ id, status: 'PROCESSING', providerOutcome: 'VERIFIED', screeningStatus: 'PENDING' });
  });

  test('IDENTITY does not call the screening service', async () => {
    const run = jest.spyOn(ScreeningService.prototype, 'run');
    const { token } = await createLink();
    await start(token);
    await uploadDocument(token);
    await uploadSelfie(token);

    expect(run).not.toHaveBeenCalled();
  });
});

describe('Document attempts', () => {
  test('[fake:doc-fail] -> 422 with attempts left, then accepted', async () => {
    const { id, token } = await createLink({ customerName: 'Jan [fake:doc-fail]' });
    await start(token);

    const first = await uploadDocument(token);
    expect(first.statusCode).toBe(422);
    expect(first.body).toMatchObject({ code: 'DOCUMENT_REJECTED', attemptsLeft: 2, reason: 'FRONT_LOW_CONFIDENCE' });
    expect((await request(app).get(session(token))).body).toMatchObject({ step: 'DOCUMENT', documentAttemptsLeft: 2 });

    const second = await uploadDocument(token);
    expect(second.statusCode).toBe(200);
    expect(stored(id)).toMatchObject({ documentAttempts: 2, documentImagePath: `org-1/${id}/document-2.bin` });
    expect(stored(id).providerVerificationIds).toHaveLength(2);
    // The rejected attempt is kept for the review
    expect(fs.existsSync(path.join(STORAGE_DIR, 'org-1', id, 'document-1.bin'))).toBe(true);
  });

  test('all attempts rejected -> REJECTED (DOCUMENT_UNREADABLE)', async () => {
    jest.spyOn(FakeIdentityProvider.prototype, 'submitDocument')
      .mockResolvedValue({ accepted: false, reason: 'FRONT_OCR_FAILED', retryable: true, raw: {} });
    const { id, token } = await createLink();
    await start(token);

    expect((await uploadDocument(token)).body.attemptsLeft).toBe(2);
    expect((await uploadDocument(token)).body.attemptsLeft).toBe(1);
    const last = await uploadDocument(token);

    expect(last.statusCode).toBe(422);
    expect(last.body.attemptsLeft).toBe(0);
    expect(stored(id)).toMatchObject({ status: 'REJECTED', decisionSource: 'AUTO', decisionReason: 'DOCUMENT_UNREADABLE' });
    expect((await request(app).get(session(token))).body.code).toBe('ALREADY_COMPLETED');
  });

  test('provider unavailable -> 502, the attempt is not counted', async () => {
    jest.spyOn(FakeIdentityProvider.prototype, 'submitDocument').mockRejectedValueOnce(new ProviderUnavailableError());
    const { id, token } = await createLink();
    await start(token);

    const res = await uploadDocument(token);

    expect(res.statusCode).toBe(502);
    expect(res.body.code).toBe('PROVIDER_UNAVAILABLE');
    expect(stored(id)).toMatchObject({ documentAttempts: 0, status: 'IN_PROGRESS', lockedUntil: null });
    expect((await uploadDocument(token)).statusCode).toBe(200);
  });

  test('upload while another one is processed -> 409', async () => {
    const { id, token } = await createLink();
    await start(token);
    stored(id).lockedUntil = new Date(Date.now() + 60_000);

    const res = await uploadDocument(token);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('INVALID_STATE');
  });
});

describe('Selfie attempts', () => {
  test('[fake:no-face] -> 422, next selfie reopens the provider session with the stored document', async () => {
    const submitDocument = jest.spyOn(FakeIdentityProvider.prototype, 'submitDocument');
    const { id, token } = await createLink({ customerName: '[fake:no-face]' });
    await start(token);
    await uploadDocument(token);

    const first = await uploadSelfie(token);
    expect(first.statusCode).toBe(422);
    expect(first.body).toMatchObject({ code: 'SELFIE_REJECTED', attemptsLeft: 2, reason: 'FACE_NOT_DETECTED' });

    const second = await uploadSelfie(token);
    expect(second.statusCode).toBe(200);
    expect(stored(id)).toMatchObject({ status: 'VERIFIED', selfieAttempts: 2, selfieImagePath: `org-1/${id}/selfie-2.bin` });
    expect(stored(id).providerVerificationIds).toHaveLength(2);
    expect(submitDocument).toHaveBeenCalledTimes(2);
    expect(submitDocument.mock.calls[1][0].file.equals(JPEG)).toBe(true);
  });

  test('no face on every attempt -> REJECTED (NO_FACE_DETECTED)', async () => {
    jest.spyOn(FakeIdentityProvider.prototype, 'submitSelfie').mockResolvedValue({ final: false, reason: 'FACE_NOT_DETECTED' });
    const { id, token } = await createLink();
    await start(token);
    await uploadDocument(token);

    await uploadSelfie(token);
    await uploadSelfie(token);
    const last = await uploadSelfie(token);

    expect(last.body.attemptsLeft).toBe(0);
    expect(stored(id)).toMatchObject({ status: 'REJECTED', decisionReason: 'NO_FACE_DETECTED' });
  });

  test('selfie before the document -> 409', async () => {
    const { token } = await createLink();
    await start(token);

    const res = await uploadSelfie(token);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('INVALID_STATE');
  });
});

describe('Consent, state and link errors', () => {
  test.each([[{ consent: false }], [{}], [{ consent: 'true' }]])('consent %p -> 400', async (body) => {
    const { token } = await createLink();
    const res = await request(app).post(`${session(token)}/start`).send(body);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('document before consent -> 409', async () => {
    const { token } = await createLink();
    expect((await uploadDocument(token)).statusCode).toBe(409);
  });

  test('second start -> 409', async () => {
    const { token } = await createLink();
    await start(token);
    expect((await start(token)).statusCode).toBe(409);
  });

  test.each([[crypto.randomBytes(32).toString('base64url')], ['short']])('unknown token %s -> 404', async (token) => {
    const res = await request(app).get(session(token));
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('expired link -> 410 LINK_EXPIRED', async () => {
    const { id, token } = await createLink();
    stored(id).linkExpiresAt = new Date(Date.now() - 1000);

    const res = await request(app).get(session(token));

    expect(res.statusCode).toBe(410);
    expect(res.body.code).toBe('LINK_EXPIRED');
    expect(stored(id).status).toBe('EXPIRED');
  });

  test('expired session -> 410 SESSION_EXPIRED', async () => {
    const { id, token } = await createLink();
    await start(token);
    stored(id).sessionExpiresAt = new Date(Date.now() - 1000);

    const res = await uploadDocument(token);

    expect(res.statusCode).toBe(410);
    expect(res.body.code).toBe('SESSION_EXPIRED');
  });
});

describe('Files', () => {
  test('file over 10 MB -> 413', async () => {
    const { token } = await createLink();
    await start(token);
    const big = Buffer.concat([JPEG, Buffer.alloc(11 * 1024 * 1024)]);

    const res = await uploadDocument(token, big);

    expect(res.statusCode).toBe(413);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
  });

  test('text file renamed to .jpg -> 415', async () => {
    const { id, token } = await createLink();
    await start(token);

    const res = await uploadDocument(token, Buffer.from('not an image at all'), 'fake.jpg');

    expect(res.statusCode).toBe(415);
    expect(res.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(stored(id).documentAttempts).toBe(0);
  });

  test('missing file -> 400', async () => {
    const { token } = await createLink();
    await start(token);

    const res = await request(app).post(`${session(token)}/document`).field('other', 'x');

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /verifications/:id/images/:kind', () => {
  const completed = async () => {
    const link = await createLink();
    await start(link.token);
    await uploadDocument(link.token);
    await uploadSelfie(link.token, PNG);
    return link;
  };

  test('returns the decrypted image with its type, never cached', async () => {
    const { id } = await completed();

    const document = await request(app).get(`/verifications/${id}/images/document`).set(apiKey()).buffer(true);
    expect(document.statusCode).toBe(200);
    expect(document.headers['content-type']).toBe('image/jpeg');
    expect(document.headers['cache-control']).toBe('no-store');
    expect(Buffer.from(document.body).equals(JPEG)).toBe(true);

    const selfie = await request(app).get(`/verifications/${id}/images/selfie`).set(apiKey()).buffer(true);
    expect(selfie.headers['content-type']).toBe('image/png');
  });

  test('another organization -> 404', async () => {
    const { id } = await completed();
    const res = await request(app).get(`/verifications/${id}/images/document`).set(apiKey('IDENTITY', 'org-2'));
    expect(res.statusCode).toBe(404);
  });

  test('after retention -> 404', async () => {
    const { id } = await completed();
    Object.assign(stored(id), { documentImagePath: null, selfieImagePath: null, imagesPurgedAt: new Date() });

    const res = await request(app).get(`/verifications/${id}/images/document`).set(apiKey());
    expect(res.statusCode).toBe(404);
  });

  test('unknown kind or no image yet -> 404', async () => {
    const { id, token } = await createLink();
    await start(token);
    expect((await request(app).get(`/verifications/${id}/images/passport`).set(apiKey())).statusCode).toBe(404);
    expect((await request(app).get(`/verifications/${id}/images/document`).set(apiKey())).statusCode).toBe(404);
  });
});
