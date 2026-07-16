import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Hashing service using bcrypt
 * Handles password hashing and verification
 */
export class BcryptHashingService {
  saltRounds: number;

  constructor(saltRounds = 10) {
    this.saltRounds = saltRounds;
  }

  /**
   * Hash a password
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Compare password with hash
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a random key
   * @param size - Key size in bytes
   * @returns Hex encoded key
   */
  generateKey(size = 32): string {
    return crypto.randomBytes(size).toString('hex');
  }

  /**
   * Generate API key with prefix
   */
  generateApiKey(): string {
    return `pk_live_${this.generateKey(24)}`;
  }

  /**
   * Generate API secret with prefix
   */
  generateApiSecret(): string {
    return `sk_live_${this.generateKey(32)}`;
  }

  /**
   * Generate password reset token
   */
  generateResetToken(): string {
    return this.generateKey(32);
  }
}

export default BcryptHashingService;
