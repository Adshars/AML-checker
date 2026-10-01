import { jest } from '@jest/globals';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createInMemoryModel } from './helpers/inMemoryModel.js';
import { makeVerification, NOW } from './helpers/verificationFactory.js';

jest.unstable_mockModule('../src/shared/logger/index.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const { MaintenanceJobs } = await import('../src/application/services/MaintenanceJobs.js');
const { ScreeningService } = await import('../src/application/services/ScreeningService.js');
const { SequelizeVerificationRepository } = await import('../src/infrastructure/database/sequelize/repositories/SequelizeVerificationRepository.js');
const { EncryptedFileStorage } = await import('../src/infrastructure/storage/EncryptedFileStorage.js');
type Verification = import('../src/domain/entities/Verification.js').Verification;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const at = (offset: number) => new Date(NOW.getTime() + offset);

const { rows, model } = createInMemoryModel();
let dir: string;
let storage: InstanceType<typeof EncryptedFileStorage>;
let jobs: InstanceType<typeof MaintenanceJobs>;

const add = (overrides: Partial<Verification>): Verification => {
  const verification = makeVerification({ id: crypto.randomUUID(), ...overrides });
  rows.push(verification as unknown as Record<string, unknown>);
  return verification;
};
const get = (id: string) => rows.find((row) => row.id === id) as Record<string, any>;

beforeEach(() => {
  rows.length = 0;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idv-jobs-'));
  const repository = new SequelizeVerificationRepository(model as never);
  storage = new EncryptedFileStorage(dir, crypto.randomBytes(32));
  jobs = new MaintenanceJobs(repository, storage, new ScreeningService(repository), 14);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('Expiry job', () => {
  test('PENDING link expires at linkExpiresAt, not before', async () => {
    const due = add({ linkExpiresAt: NOW });
    const notYet = add({ linkExpiresAt: at(1) });

    const summary = await jobs.runOnce(NOW);

    expect(summary.expired).toBe(1);
    expect(get(due.id)).toMatchObject({ status: 'EXPIRED', tokenEncrypted: null });
    expect(get(notYet.id).status).toBe('PENDING');
  });

  test('IN_PROGRESS session expires at sessionExpiresAt unless an upload is being processed', async () => {
    const due = add({ status: 'IN_PROGRESS', sessionExpiresAt: NOW });
    const notYet = add({ status: 'IN_PROGRESS', sessionExpiresAt: at(MINUTE) });
    const busy = add({ status: 'IN_PROGRESS', sessionExpiresAt: at(-MINUTE), lockedUntil: at(MINUTE) });
    const staleLock = add({ status: 'IN_PROGRESS', sessionExpiresAt: at(-MINUTE), lockedUntil: at(-1) });

    await jobs.runOnce(NOW);

    expect(get(due.id).status).toBe('EXPIRED');
    expect(get(notYet.id).status).toBe('IN_PROGRESS');
    expect(get(busy.id).status).toBe('IN_PROGRESS');
    expect(get(staleLock.id).status).toBe('EXPIRED');
  });

  test('other statuses are never expired', async () => {
    const processing = add({ status: 'PROCESSING', linkExpiresAt: at(-DAY), sessionExpiresAt: at(-DAY) });
    const review = add({ status: 'MANUAL_REVIEW', linkExpiresAt: at(-DAY) });

    await jobs.runOnce(NOW);

    expect(get(processing.id).status).toBe('PROCESSING');
    expect(get(review.id).status).toBe('MANUAL_REVIEW');
  });
});

describe('Image retention job', () => {
  test('images older than 14 days are deleted, the result is kept', async () => {
    const old = add({ status: 'VERIFIED', createdAt: at(-14 * DAY - 1), organizationId: 'org1' });
    const documentPath = await storage.save('org1', old.id, 'document-1', Buffer.from('x'));
    Object.assign(get(old.id), { documentImagePath: documentPath, selfieImagePath: 'org1/x/selfie-1.bin' });
    const young = add({ status: 'VERIFIED', createdAt: at(-14 * DAY), organizationId: 'org1' });
    const youngPath = await storage.save('org1', young.id, 'document-1', Buffer.from('y'));
    get(young.id).documentImagePath = youngPath;

    const summary = await jobs.runOnce(NOW);

    expect(summary.purged).toBe(1);
    expect(get(old.id)).toMatchObject({ status: 'VERIFIED', documentImagePath: null, selfieImagePath: null });
    expect(new Date(get(old.id).imagesPurgedAt).getTime()).toBe(NOW.getTime());
    expect(fs.existsSync(path.join(dir, 'org1', old.id))).toBe(false);
    expect(get(young.id).documentImagePath).toBe(youngPath);
    expect(fs.existsSync(path.join(dir, youngPath))).toBe(true);
  });

  test('already purged verifications are skipped', async () => {
    add({ createdAt: at(-30 * DAY), imagesPurgedAt: at(-10 * DAY) });
    expect((await jobs.runOnce(NOW)).purged).toBe(0);
  });

  test('a failing job does not stop the others', async () => {
    add({ linkExpiresAt: at(-1) });
    add({ createdAt: at(-30 * DAY) });
    jest.spyOn(storage, 'deleteVerificationDir').mockRejectedValueOnce(new Error('disk error'));

    const summary = await jobs.runOnce(NOW);

    expect(summary.expired).toBe(1);
    expect(summary.purged).toBe(0);
  });
});
