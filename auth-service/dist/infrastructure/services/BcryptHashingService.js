import bcrypt from 'bcryptjs';
import crypto from 'crypto';
/**
 * Hashing service using bcrypt
 * Handles password hashing and verification
 */
export class BcryptHashingService {
    saltRounds;
    constructor(saltRounds = 10) {
        this.saltRounds = saltRounds;
    }
    /**
     * Hash a password
     */
    async hash(password) {
        return bcrypt.hash(password, this.saltRounds);
    }
    /**
     * Compare password with hash
     */
    async compare(password, hash) {
        return bcrypt.compare(password, hash);
    }
    /**
     * Generate a random key
     * @param size - Key size in bytes
     * @returns Hex encoded key
     */
    generateKey(size = 32) {
        return crypto.randomBytes(size).toString('hex');
    }
    /**
     * Generate API key with prefix
     */
    generateApiKey() {
        return `pk_live_${this.generateKey(24)}`;
    }
    /**
     * Generate API secret with prefix
     */
    generateApiSecret() {
        return `sk_live_${this.generateKey(32)}`;
    }
    /**
     * Generate password reset token
     */
    generateResetToken() {
        return this.generateKey(32);
    }
}
export default BcryptHashingService;
