import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nock from 'nock';

jest.unstable_mockModule('../src/shared/logger/index.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const { IdswyftProvider, mapOcr } = await import('../src/infrastructure/providers/IdswyftProvider.js');

// Masked responses recorded from a real document with `npm run idv:probe -- ... --save-fixtures`
const RECORDED = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'idswyft', 'recorded');
const load = (name: string) => {
  const file = path.join(RECORDED, `${name}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
};

const front = load('front-document');
const status = load('status');
const describeRecorded = front && status ? describe : describe.skip;

describeRecorded('Contract with recorded idswyft responses (real document)', () => {
  afterEach(() => nock.cleanAll());

  test('front-document OCR maps to the fields the panel shows', () => {
    const ocr = mapOcr(front.ocr_data, front.detected_document_type);

    expect(ocr.fullName).toEqual(expect.any(String));
    expect(ocr.dateOfBirth).toEqual(expect.any(String));
    expect(ocr.documentNumber).toEqual(expect.any(String));
  });

  test('status maps to a final outcome with liveness and face match', async () => {
    nock('http://idswyft.recorded').get(/\/status$/).reply(200, status);
    const provider = new IdswyftProvider({ baseUrl: 'http://idswyft.recorded', apiKey: 'k', timeoutMs: 2000 });

    const result = await provider.getResult({ providerVerificationId: String(status.verification_id) });

    expect(['VERIFIED', 'REJECTED', 'MANUAL_REVIEW']).toContain(result.outcome);
    expect(result.liveness.passed).toEqual(expect.any(Boolean));
  });
});

test('recorded fixtures are optional', () => {
  if (!front || !status) {
    console.info('No recorded idswyft fixtures — run `npm run idv:probe -- <doc> <selfie> --save-fixtures` to add them');
  }
  expect(true).toBe(true);
});
