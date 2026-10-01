import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

/**
 * Encrypted image copies: <dir>/<organizationId>/<verificationId>/<name>.bin
 * File format: IV (12 B) | authTag (16 B) | AES-256-GCM ciphertext
 */
export class EncryptedFileStorage {
  baseDir: string;
  key: Buffer;

  constructor(baseDir: string, key: Buffer) {
    this.baseDir = path.resolve(baseDir);
    this.key = key;
  }

  private verificationDir(organizationId: string, verificationId: string): string {
    for (const segment of [organizationId, verificationId]) {
      if (!SAFE_SEGMENT.test(segment)) {
        throw new Error('Unsafe storage path segment');
      }
    }
    return path.join(this.baseDir, organizationId, verificationId);
  }

  /**
   * Returns the stored path (relative to the storage directory)
   */
  async save(organizationId: string, verificationId: string, name: string, data: Buffer): Promise<string> {
    if (!SAFE_SEGMENT.test(name)) {
      throw new Error('Unsafe storage file name');
    }
    const dir = this.verificationDir(organizationId, verificationId);
    await fs.mkdir(dir, { recursive: true });

    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    const file = path.join(dir, `${name}.bin`);
    await fs.writeFile(file, Buffer.concat([iv, cipher.getAuthTag(), ciphertext]));

    return path.relative(this.baseDir, file).split(path.sep).join('/');
  }

  /**
   * Throws when the key is wrong or the file was modified
   */
  async read(storedPath: string): Promise<Buffer> {
    const file = path.resolve(this.baseDir, storedPath);
    if (!file.startsWith(this.baseDir + path.sep)) {
      throw new Error('Path outside the storage directory');
    }
    const data = await fs.readFile(file);
    const iv = data.subarray(0, IV_BYTES);
    const authTag = data.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(data.subarray(IV_BYTES + AUTH_TAG_BYTES)), decipher.final()]);
  }

  /**
   * Removes all images of a verification (retention)
   */
  async deleteVerificationDir(organizationId: string, verificationId: string): Promise<void> {
    await fs.rm(this.verificationDir(organizationId, verificationId), { recursive: true, force: true });
  }
}

export default EncryptedFileStorage;
