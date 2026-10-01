import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nock from 'nock';

jest.unstable_mockModule('../src/shared/logger/index.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const { IdswyftProvider, mapOcr, toReviewReason } = await import('../src/infrastructure/providers/IdswyftProvider.js');
const { ProviderUnavailableError } = await import('../src/shared/errors/index.js');

const BASE = 'http://idswyft.test';
const API = '/api/v2/verify';
const API_KEY = 'ik_test_key';
const VERIFICATION_ID = '11111111-1111-4111-8111-111111111111';
const PVID = 'f257c04a-fc31-4be3-9109-eff930e3f92f';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'idswyft', `${name}.json`), 'utf8'));

// nock hands binary (multipart) bodies over as hex
const bodyText = (body: unknown): string => {
  const text = String(body);
  return /^[0-9a-f]+$/.test(text) ? Buffer.from(text, 'hex').toString('latin1') : text;
};

const sleep = jest.fn(async (_ms: number) => {});
const createProvider = (overrides = {}) =>
  new IdswyftProvider({ baseUrl: BASE, apiKey: API_KEY, timeoutMs: 2000, sleep, ...overrides });

const image = (attempt = 1) => ({ providerVerificationId: PVID, file: JPEG, mime: 'image/jpeg' as const, attempt });

beforeAll(() => nock.disableNetConnect());
afterEach(() => {
  nock.cleanAll();
  sleep.mockClear();
});
afterAll(() => nock.enableNetConnect());

describe('initialize', () => {
  test('opens an identity-mode session for our verification id with the customer IP', async () => {
    let body: unknown;
    const scope = nock(BASE, {
      reqheaders: {
        'x-api-key': API_KEY,
        'idempotency-key': `${VERIFICATION_ID}-initialize-2`,
        'x-forwarded-for': '203.0.113.5'
      }
    })
      .post(`${API}/initialize`, (b) => { body = b; return true; })
      .reply(201, fixture('initialize'));

    const result = await createProvider().initialize({
      verificationId: VERIFICATION_ID, sessionNumber: 2, clientIp: '203.0.113.5', customerName: null
    });

    expect(result).toEqual({ providerVerificationId: PVID });
    expect(body).toEqual({ user_id: VERIFICATION_ID, verification_mode: 'identity', document_type: 'auto' });
    expect(scope.isDone()).toBe(true);
  });

  test('invalid client IP is not forwarded', async () => {
    const scope = nock(BASE, { badheaders: ['x-forwarded-for'] })
      .post(`${API}/initialize`)
      .reply(201, fixture('initialize'));

    await createProvider().initialize({ verificationId: VERIFICATION_ID, sessionNumber: 1, clientIp: 'not-an-ip', customerName: null });
    expect(scope.isDone()).toBe(true);
  });

  test('unexpected status -> ProviderUnavailableError', async () => {
    nock(BASE).post(`${API}/initialize`).reply(401, { message: 'Invalid API key' });

    await expect(createProvider().initialize({ verificationId: VERIFICATION_ID, sessionNumber: 1, clientIp: null, customerName: null }))
      .rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});

describe('submitDocument', () => {
  test('accepted document -> mapped OCR', async () => {
    let rawBody = '';
    nock(BASE, { reqheaders: { 'x-api-key': API_KEY, 'idempotency-key': `${PVID}-front-document` } })
      .post(`${API}/${PVID}/front-document`, (b) => { rawBody = bodyText(b); return true; })
      .reply(200, fixture('front-document'));

    const outcome = await createProvider().submitDocument(image());

    expect(outcome.accepted).toBe(true);
    if (!outcome.accepted) return;
    expect(outcome.ocr).toEqual({
      fullName: 'JAN TESTOWY',
      dateOfBirth: '1985-03-14',
      documentNumber: 'ABC123456',
      expiryDate: '2031-07-01',
      nationality: 'POL',
      issuingCountry: 'PL',
      documentType: 'national_id',
      ocrConfidence: expect.closeTo(0.91, 5)
    });
    expect(rawBody).toContain('name="document"; filename="document.jpg"');
    expect(rawBody).toContain('Content-Type: image/jpeg');
  });

  test('gate 1 rejection -> retryable, with the provider reason', async () => {
    nock(BASE).post(`${API}/${PVID}/front-document`).reply(200, fixture('front-document-rejected'));

    const outcome = await createProvider().submitDocument(image());

    expect(outcome).toMatchObject({ accepted: false, reason: 'FRONT_LOW_CONFIDENCE', retryable: true });
  });

  test('400 (image the engine cannot decode) -> retryable INVALID_IMAGE', async () => {
    nock(BASE).post(`${API}/${PVID}/front-document`).reply(400, { message: 'Invalid file type' });

    const outcome = await createProvider().submitDocument(image());

    expect(outcome).toMatchObject({ accepted: false, reason: 'INVALID_IMAGE', retryable: true });
  });

  test.each([500, 503, 409, 429])('HTTP %i -> ProviderUnavailableError', async (status) => {
    nock(BASE).post(`${API}/${PVID}/front-document`).reply(status, {});
    await expect(createProvider().submitDocument(image())).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  test('network error -> ProviderUnavailableError', async () => {
    nock(BASE).post(`${API}/${PVID}/front-document`).replyWithError('connect ECONNREFUSED');
    await expect(createProvider().submitDocument(image())).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  test('timeout -> ProviderUnavailableError', async () => {
    nock(BASE).post(`${API}/${PVID}/front-document`).delay(500).reply(200, fixture('front-document'));
    await expect(createProvider({ timeoutMs: 50 }).submitDocument(image())).rejects.toThrow('timed out');
  });

  test('waits so consecutive steps are at least 2.1 s apart (bot-like timing flag)', async () => {
    nock(BASE).post(`${API}/initialize`).reply(201, fixture('initialize'));
    nock(BASE).post(`${API}/${PVID}/front-document`).reply(200, fixture('front-document'));
    const provider = createProvider();

    await provider.initialize({ verificationId: VERIFICATION_ID, sessionNumber: 1, clientIp: null, customerName: null });
    await provider.submitDocument(image());

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0][0]).toBeGreaterThan(1500);
    expect(sleep.mock.calls[0][0]).toBeLessThanOrEqual(2100);
  });

  test('no wait for a session this process has not seen', async () => {
    nock(BASE).post(`${API}/${PVID}/front-document`).reply(200, fixture('front-document'));
    await createProvider().submitDocument(image());
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe('submitSelfie', () => {
  test('completed live capture -> final', async () => {
    let rawBody = '';
    nock(BASE, { reqheaders: { 'idempotency-key': `${PVID}-live-capture` } })
      .post(`${API}/${PVID}/live-capture`, (b) => { rawBody = bodyText(b); return true; })
      .reply(200, fixture('live-capture'));

    await expect(createProvider().submitSelfie(image())).resolves.toEqual({ final: true });
    expect(rawBody).toContain('name="selfie"');
  });

  test('no face detected -> not final (customer may retake)', async () => {
    nock(BASE).post(`${API}/${PVID}/live-capture`).reply(200, fixture('live-capture-no-face'));
    await expect(createProvider().submitSelfie(image())).resolves.toEqual({ final: false, reason: 'FACE_NOT_DETECTED' });
  });

  test('face match failure is final', async () => {
    const failed = { ...fixture('live-capture'), final_result: 'failed', rejection_reason: 'FACE_MATCH_FAILED' };
    nock(BASE).post(`${API}/${PVID}/live-capture`).reply(200, failed);
    await expect(createProvider().submitSelfie(image())).resolves.toEqual({ final: true });
  });

  test('5xx -> ProviderUnavailableError', async () => {
    nock(BASE).post(`${API}/${PVID}/live-capture`).reply(502, {});
    await expect(createProvider().submitSelfie(image())).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});

describe('getResult', () => {
  test('verified', async () => {
    nock(BASE, { reqheaders: { 'x-api-key': API_KEY } }).get(`${API}/${PVID}/status`).reply(200, fixture('status'));

    const result = await createProvider().getResult({ providerVerificationId: PVID });

    expect(result).toMatchObject({
      outcome: 'VERIFIED',
      reason: null,
      liveness: { passed: true, score: 0.91 },
      faceMatch: { passed: true, score: 0.82 }
    });
    expect(result.raw.final_result).toBe('verified');
  });

  test('manual review with a skipped face match -> no face match score', async () => {
    nock(BASE).get(`${API}/${PVID}/status`).reply(200, fixture('status-manual-review'));

    const result = await createProvider().getResult({ providerVerificationId: PVID });

    expect(result).toMatchObject({
      outcome: 'MANUAL_REVIEW',
      reason: 'FACE_MATCH_SKIPPED',
      faceMatch: { passed: null, score: null }
    });
  });

  test('rejected -> provider rejection reason', async () => {
    nock(BASE).get(`${API}/${PVID}/status`).reply(200, fixture('status-rejected'));

    const result = await createProvider().getResult({ providerVerificationId: PVID });

    expect(result).toMatchObject({ outcome: 'REJECTED', reason: 'FACE_MATCH_FAILED', faceMatch: { passed: false, score: 0.31 } });
  });

  test('result not final yet -> ProviderUnavailableError', async () => {
    nock(BASE).get(`${API}/${PVID}/status`).reply(200, { ...fixture('status'), final_result: null });
    await expect(createProvider().getResult({ providerVerificationId: PVID })).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});

describe('Mapping helpers', () => {
  test('mapOcr falls back to raw engine fields and tolerates missing data', () => {
    expect(mapOcr({ name: 'ANNA NOWAK', document_number: 'XYZ1', expiration_date: '2030-01-01', full_name: '' }))
      .toMatchObject({ fullName: 'ANNA NOWAK', documentNumber: 'XYZ1', expiryDate: '2030-01-01', ocrConfidence: null });
    expect(mapOcr(null)).toEqual({
      fullName: null, dateOfBirth: null, documentNumber: null, expiryDate: null,
      nationality: null, issuingCountry: null, documentType: null, ocrConfidence: null
    });
  });

  test.each([
    ['Face match skipped: No face embedding from ID document', 'FACE_MATCH_SKIPPED'],
    ['Velocity flags: rapid_ip_reuse', 'VELOCITY_FLAGS'],
    ['Geo flags: country_mismatch', 'GEO_FLAGS'],
    ['Cross-validation requires review', 'CROSS_VALIDATION_REVIEW'],
    ['Duplicate face detected: 1 match(es) found', 'DUPLICATE_DETECTED'],
    [null, 'PROVIDER_REVIEW']
  ])('manual review reason %p -> %s', (text, code) => {
    expect(toReviewReason(text)).toBe(code);
  });
});
