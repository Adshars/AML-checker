/**
 * PasswordResetToken Repository Interface
 * Defines the contract for password reset token data access
 */
export class IPasswordResetTokenRepository {
    /**
     * Find password reset token by user ID
     */
    async findByUserId(userId) {
        throw new Error('Method not implemented');
    }
    /**
     * Find password reset token by token string
     */
    async findByToken(token) {
        throw new Error('Method not implemented');
    }
    /**
     * Create a new password reset token
     */
    async create(passwordResetToken) {
        throw new Error('Method not implemented');
    }
    /**
     * Delete password reset token by user ID
     */
    async deleteByUserId(userId) {
        throw new Error('Method not implemented');
    }
    /**
     * Delete password reset token by token string
     */
    async deleteByToken(token) {
        throw new Error('Method not implemented');
    }
}
export default IPasswordResetTokenRepository;
