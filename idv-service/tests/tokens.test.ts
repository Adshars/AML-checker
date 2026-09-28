import crypto from 'crypto';
import { decryptToken, encryptToken, generateToken, hashToken, parseKey } from '../src/infrastructure/security/tokens.js';

const KEY = parseKey(crypto.randomBytes(32).toString('hex'));

describe('Verification link tokens', () => {
  test('tokens are URL-safe and unique', () => {
    const tokens = new Set(Array.from({ length: 200 }, generateToken));

    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  test('hash is deterministic SHA-256 hex and differs from the token', () => {
    const token = generateToken();

    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toBe(hashToken(generateToken()));
  });

  test('encryption round-trips and uses a random IV', () => {
    const token = generateToken();
    const first = encryptToken(token, KEY);
    const second = encryptToken(token, KEY);

    expect(first).not.toBe(second);
    expect(first).not.toContain(token);
    expect(decryptToken(first, KEY)).toBe(token);
    expect(decryptToken(second, KEY)).toBe(token);
  });

  test('wrong key -> error', () => {
    const encrypted = encryptToken(generateToken(), KEY);
    const otherKey = parseKey(crypto.randomBytes(32).toString('hex'));

    expect(() => decryptToken(encrypted, otherKey)).toThrow();
  });

  test('tampered ciphertext -> error', () => {
    const data = Buffer.from(encryptToken(generateToken(), KEY), 'base64');
    data[data.length - 1] ^= 0xff;

    expect(() => decryptToken(data.toString('base64'), KEY)).toThrow();
  });

  test('malformed data -> error', () => {
    expect(() => decryptToken('c2hvcnQ=', KEY)).toThrow('malformed');
  });

  test('key must be 64 hex characters', () => {
    expect(() => parseKey('abc')).toThrow();
    expect(() => parseKey('z'.repeat(64))).toThrow();
    expect(parseKey('0'.repeat(64))).toHaveLength(32);
  });
});
