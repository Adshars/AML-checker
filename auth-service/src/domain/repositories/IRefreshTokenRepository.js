/**
 * RefreshToken Repository Interface
 * Defines the contract for refresh token data access
 */
export class IRefreshTokenRepository {
  /**
   * Find refresh token by token string
   * @param {string} token
   * @returns {Promise<RefreshToken|null>}
   */
  async findByToken(token) {
    throw new Error('Method not implemented');
  }

  /**
   * Find all refresh tokens by user ID
   * @param {string} userId
   * @returns {Promise<RefreshToken[]>}
   */
  async findByUserId(userId) {
    throw new Error('Method not implemented');
  }

  /**
   * Create a new refresh token
   * @param {RefreshToken} refreshToken
   * @returns {Promise<RefreshToken>}
   */
  async create(refreshToken) {
    throw new Error('Method not implemented');
  }

  /**
   * Delete refresh token by token string
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async deleteByToken(token) {
    throw new Error('Method not implemented');
  }

  /**
   * Delete all refresh tokens for a user
   * @param {string} userId
   * @returns {Promise<number>} - Number of deleted tokens
   */
  async deleteByUserId(userId) {
    throw new Error('Method not implemented');
  }
}

export default IRefreshTokenRepository;
