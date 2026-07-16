/**
 * RefreshToken Repository Interface
 * Defines the contract for refresh token data access
 */
export class IRefreshTokenRepository {
    /**
     * Find refresh token by token string
     */
    async findByToken(token) {
        throw new Error('Method not implemented');
    }
    /**
     * Find all refresh tokens by user ID
     */
    async findByUserId(userId) {
        throw new Error('Method not implemented');
    }
    /**
     * Create a new refresh token
     */
    async create(refreshToken) {
        throw new Error('Method not implemented');
    }
    /**
     * Delete refresh token by token string
     */
    async deleteByToken(token) {
        throw new Error('Method not implemented');
    }
    /**
     * Delete all refresh tokens for a user
     * @returns Number of deleted tokens
     */
    async deleteByUserId(userId) {
        throw new Error('Method not implemented');
    }
}
export default IRefreshTokenRepository;
