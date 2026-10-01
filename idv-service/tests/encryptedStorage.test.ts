import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EncryptedFileStorage } from '../src/infrastructure/storage/EncryptedFileStorage.js';

const KEY = crypto.randomBytes(32);
const IMAGE = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), crypto.randomBytes(1024)]);

let dir: string;
let storage: EncryptedFileStorage;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idv-storage-'));
  storage = new EncryptedFileStorage(dir, KEY);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('EncryptedFileStorage', () => {
  test('save → read round-trips; the file on disk is encrypted', async () => {
    const storedPath = await storage.save('org1', 'ver-1', 'document-1', IMAGE);

    expect(storedPath).toBe('org1/ver-1/document-1.bin');
    const onDisk = fs.readFileSync(path.join(dir, storedPath));
    expect(onDisk.length).toBe(IMAGE.length + 12 + 16);
    expect(onDisk.includes(IMAGE.subarray(3, 67))).toBe(false);
    expect((await storage.read(storedPath)).equals(IMAGE)).toBe(true);
  });

  test('same image twice -> different ciphertext (random IV)', async () => {
    const a = await storage.save('org1', 'ver-1', 'selfie-1', IMAGE);
    const b = await storage.save('org1', 'ver-1', 'selfie-2', IMAGE);

    expect(fs.readFileSync(path.join(dir, a)).equals(fs.readFileSync(path.join(dir, b)))).toBe(false);
  });

  test('wrong key -> error', async () => {
    const storedPath = await storage.save('org1', 'ver-1', 'document-1', IMAGE);
    const other = new EncryptedFileStorage(dir, crypto.randomBytes(32));

    await expect(other.read(storedPath)).rejects.toThrow();
  });

  test('tampered file -> error', async () => {
    const storedPath = await storage.save('org1', 'ver-1', 'document-1', IMAGE);
    const file = path.join(dir, storedPath);
    const data = fs.readFileSync(file);
    data[data.length - 1] ^= 0xff;
    fs.writeFileSync(file, data);

    await expect(storage.read(storedPath)).rejects.toThrow();
  });

  test('unsafe path segments and reads outside the directory are refused', async () => {
    await expect(storage.save('../org', 'ver-1', 'document-1', IMAGE)).rejects.toThrow('Unsafe');
    await expect(storage.save('org1', 'ver/1', 'document-1', IMAGE)).rejects.toThrow('Unsafe');
    await expect(storage.save('org1', 'ver-1', '../x', IMAGE)).rejects.toThrow('Unsafe');
    await expect(storage.read('../outside.bin')).rejects.toThrow('outside');
  });

  test('deleteVerificationDir removes only that verification', async () => {
    await storage.save('org1', 'ver-1', 'document-1', IMAGE);
    const kept = await storage.save('org1', 'ver-2', 'document-1', IMAGE);

    await storage.deleteVerificationDir('org1', 'ver-1');

    expect(fs.existsSync(path.join(dir, 'org1', 'ver-1'))).toBe(false);
    expect(fs.existsSync(path.join(dir, kept))).toBe(true);
    // Deleting twice is fine
    await expect(storage.deleteVerificationDir('org1', 'ver-1')).resolves.toBeUndefined();
  });
});
