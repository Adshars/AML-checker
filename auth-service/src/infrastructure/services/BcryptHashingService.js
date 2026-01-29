import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Hashing service using bcrypt
 * Handles password hashing and verification
 */
export class BcryptHashingService {
  constructor(saltRounds = 10) {
    this.saltRounds = saltRounds;
  }

  /**
   * Hash a password
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  async hash(password) {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} - True if match
   */
  async compare(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a random key
   * @param {number} size - Key size in bytes
   * @returns {string} - Hex encoded key
   */
  generateKey(size = 32) {
    return crypto.randomBytes(size).toString('hex');
  }

  /**
   * Generate API key with prefix
   * @returns {string} - API key with pk_live_ prefix
   */
  generateApiKey() {
    return `pk_live_${this.generateKey(24)}`;
  }

  /**
   * Generate API secret with prefix
   * @returns {string} - API secret with sk_live_ prefix
   */
  generateApiSecret() {
    return `sk_live_${this.generateKey(32)}`;
  }

  /**
   * Generate password reset token
   * @returns {string} - Random hex token
   */
  generateResetToken() {
    return this.generateKey(32);
  }
}

export default BcryptHashingService;
