import crypto from 'crypto';

const TOKEN_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

/**
 * 32-byte AES-256 key from its 64-character hex form
 */
export const parseKey = (hex: string): Buffer => {
  if (!KEY_PATTERN.test(hex)) {
    throw new Error('Encryption key must be 64 hex characters');
  }
  return Buffer.from(hex, 'hex');
};

/**
 * Random verification link token (URL-safe)
 */
export const generateToken = (): string => crypto.randomBytes(TOKEN_BYTES).toString('base64url');

/**
 * Tokens are stored and looked up only by their SHA-256 hash
 */
export const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

/**
 * AES-256-GCM: base64( IV (12 B) | authTag (16 B) | ciphertext )
 */
export const encryptToken = (token: string, key: Buffer): string => {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
};

/**
 * Throws when the key is wrong or the data was tampered with
 */
export const decryptToken = (encrypted: string, key: Buffer): string => {
  const data = Buffer.from(encrypted, 'base64');
  if (data.length <= IV_BYTES + AUTH_TAG_BYTES) {
    throw new Error('Encrypted token is malformed');
  }
  const iv = data.subarray(0, IV_BYTES);
  const authTag = data.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = data.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};
