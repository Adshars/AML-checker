import { jest } from '@jest/globals';
import crypto from 'crypto';
import nock from 'nock';
import { createInMemoryModel } from './helpers/inMemoryModel.js';
import { makeVerification, NOW } from './helpers/verificationFactory.js';

jest.unstable_mockModule('../src/shared/logger/index.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const { ScreeningService } = await import('../src/application/services/ScreeningService.js');
const { CoreServiceClient } = await import('../src/infrastructure/clients/CoreServiceClient.js');
const { SequelizeVerificationRepository } = await import('../src/infrastructure/database/sequelize/repositories/SequelizeVerificationRepository.js');
type Verification = import('../src/domain/entities/Verification.js').Verification;

const CORE = 'http://core-service.test';
const AUDIT_ID = '7d3c2b1a-0f9e-4d8c-b7a6-5e4d3c2b1a0f';
const MINUTE = 60 * 1000;

const { rows, model } = createInMemoryModel();
const repository = new SequelizeVerificationRepository(model as never);
const service = new ScreeningService(repository, new CoreServiceClient(CORE), () => NOW);

const OCR = {
  fullName: 'Jan Testowy', dateOfBirth: '1985-03-14', documentNumber: 'ABC123456', expiryDate: '2031-07-01',
  nationality: 'POL', issuingCountry: 'PL', documentType: 'national_id', ocrConfidence: 0.91
};

const awaitingScreening = (overrides: Partial<Verification> = {}): Verification => {
  const verification = makeVerification({
    id: crypto.randomUUID(),
    identityMode: 'FULL_AML',
    status: 'PROCESSING',
    providerOutcome: 'VERIFIED',
    screeningStatus: 'PENDING',
    ocr: OCR,
    ...overrides
  });
  // Stored copy — changing the "database" row must not change the object passed to the service
  rows.push(structuredClone(verification) as unknown as Record<string, unknown>);
  return verification;
};
const stored = (id: string) => rows.find((row) => row.id === id) as Record<string, any>;

const coreReply = (hits: number, audit: Record<string, unknown> | null = {
  id: AUDIT_ID, hasHit: hits > 0, isSanctioned: hits > 0, isPep: false,
  entityName: hits > 0 ? 'Vladimir Putin' : null, entityScore: hits > 0 ? 0.97 : null
}) => ({ hits_count: hits, data: [], audit });

beforeAll(() => nock.disableNetConnect());
afterEach(() => {
  nock.cleanAll();
  rows.length = 0;
});
afterAll(() => nock.enableNetConnect());

describe('Screening request', () => {
  test('core-service /check is called with the OCR name and internal idv headers', async () => {
    const verification = awaitingScreening({ organizationId: 'org-9' });
    let query: Record<string, string> = {};
    const scope = nock(CORE, {
      reqheaders: {
        'x-org-id': 'org-9',
        'x-auth-type': 'internal',
        'x-source': 'idv',
        'x-idv-verification-id': verification.id,
        'x-user-id': 'idv-service',
        'x-user-name': encodeURIComponent('IDV auto-screening'),
        'x-user-email': 'idv@system'
      }
    })
      .get('/check')
      .query((q) => { query = q as Record<string, string>; return true; })
      .reply(200, coreReply(0));

    await service.run(verification);

    expect(scope.isDone()).toBe(true);
    expect(query).toEqual({ name: 'Jan Testowy', schema: 'Person', limit: '10' });
  });
});

describe('Screening outcomes', () => {
  test('CLEAR → the provider outcome becomes final', async () => {
    const verification = awaitingScreening();
    nock(CORE).get('/check').query(true).reply(200, coreReply(0));

    await service.run(verification);

    expect(stored(verification.id)).toMatchObject({
      status: 'VERIFIED',
      screeningStatus: 'CLEAR',
      screeningHitsCount: 0,
      screeningAttempts: 1,
      auditLogId: AUDIT_ID,
      decisionSource: 'AUTO'
    });
  });

  test('HIT on a verified identity → MANUAL_REVIEW (SCREENING_HIT) with the top match', async () => {
    const verification = awaitingScreening();
    nock(CORE).get('/check').query(true).reply(200, coreReply(2));

    await service.run(verification);

    expect(stored(verification.id)).toMatchObject({
      status: 'MANUAL_REVIEW',
      decisionReason: 'SCREENING_HIT',
      screeningStatus: 'HIT',
      screeningHitsCount: 2,
      screeningIsSanctioned: true,
      screeningIsPep: false,
      screeningTopMatch: { name: 'Vladimir Putin', score: 0.97 }
    });
  });

  test('HIT on a rejected identity stays REJECTED, the screening is still recorded', async () => {
    const verification = awaitingScreening({ providerOutcome: 'REJECTED', decisionReason: 'FACE_MATCH_FAILED' });
    nock(CORE).get('/check').query(true).reply(200, coreReply(1));

    await service.run(verification);

    expect(stored(verification.id)).toMatchObject({
      status: 'REJECTED',
      decisionReason: 'FACE_MATCH_FAILED',
      screeningStatus: 'HIT',
      auditLogId: AUDIT_ID
    });
  });

  test('no name on the document → MANUAL_REVIEW (SCREENING_NO_NAME), core-service is not called', async () => {
    const verification = awaitingScreening({ ocr: { ...OCR, fullName: null } });

    await service.run(verification);

    expect(stored(verification.id)).toMatchObject({
      status: 'MANUAL_REVIEW',
      decisionReason: 'SCREENING_NO_NAME',
      screeningStatus: 'ERROR'
    });
  });
});

describe('Screening failures are never clear', () => {
  test.each([
    ['core-service 502', () => nock(CORE).get('/check').query(true).reply(502, { error: 'Validation failed downstream' })],
    ['connection refused', () => nock(CORE).get('/check').query(true).replyWithError('connect ECONNREFUSED')],
    ['audit entry missing', () => nock(CORE).get('/check').query(true).reply(200, coreReply(0, null))]
  ])('%s → ERROR, still PROCESSING, attempt counted', async (_name, mock) => {
    const verification = awaitingScreening();
    mock();

    await service.run(verification);

    expect(stored(verification.id)).toMatchObject({
      status: 'PROCESSING',
      screeningStatus: 'ERROR',
      screeningAttempts: 1,
      auditLogId: null
    });
  });

  test('12th failed attempt → MANUAL_REVIEW (SCREENING_FAILED)', async () => {
    const verification = awaitingScreening({ screeningStatus: 'ERROR', screeningAttempts: 11 });
    nock(CORE).get('/check').query(true).reply(500, {});

    await service.run(verification);

    expect(stored(verification.id)).toMatchObject({
      status: 'MANUAL_REVIEW',
      decisionReason: 'SCREENING_FAILED',
      screeningStatus: 'ERROR',
      screeningAttempts: 12
    });
  });

  test('a parallel run that already changed the attempt counter wins', async () => {
    const verification = awaitingScreening();
    stored(verification.id).screeningAttempts = 1;
    nock(CORE).get('/check').query(true).reply(200, coreReply(2));

    await service.run(verification);

    expect(stored(verification.id)).toMatchObject({ status: 'PROCESSING', screeningStatus: 'PENDING' });
  });
});

describe('Retry job', () => {
  test('retries failed and interrupted screenings untouched for a minute', async () => {
    const failed = awaitingScreening({ screeningStatus: 'ERROR', screeningAttempts: 3, updatedAt: new Date(NOW.getTime() - 5 * MINUTE) });
    const interrupted = awaitingScreening({ screeningStatus: 'PENDING', updatedAt: new Date(NOW.getTime() - 2 * MINUTE) });
    const fresh = awaitingScreening({ screeningStatus: 'ERROR', updatedAt: new Date(NOW.getTime() - 10 * 1000) });
    const identity = awaitingScreening({ identityMode: 'IDENTITY', screeningStatus: 'ERROR', updatedAt: new Date(NOW.getTime() - 5 * MINUTE) });
    const done = awaitingScreening({ status: 'VERIFIED', screeningStatus: 'CLEAR', updatedAt: new Date(NOW.getTime() - 5 * MINUTE) });
    nock(CORE).get('/check').query(true).times(2).reply(200, coreReply(0));

    const retried = await service.retryFailed(NOW);

    expect(retried).toBe(2);
    expect(stored(failed.id)).toMatchObject({ status: 'VERIFIED', screeningStatus: 'CLEAR', screeningAttempts: 4 });
    expect(stored(interrupted.id)).toMatchObject({ status: 'VERIFIED', screeningStatus: 'CLEAR' });
    expect(stored(fresh.id).screeningStatus).toBe('ERROR');
    expect(stored(identity.id).screeningStatus).toBe('ERROR');
    expect(stored(done.id).status).toBe('VERIFIED');
  });
});
