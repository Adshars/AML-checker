/**
 * PasswordResetToken Repository Interface
 * Defines the contract for password reset token data access
 */
export class IPasswordResetTokenRepository {
  /**
   * Find password reset token by user ID
   * @param {string} userId
   * @returns {Promise<PasswordResetToken|null>}
   */
  async findByUserId(userId) {
    throw new Error('Method not implemented');
  }

  /**
   * Find password reset token by token string
   * @param {string} token
   * @returns {Promise<PasswordResetToken|null>}
   */
  async findByToken(token) {
    throw new Error('Method not implemented');
  }

  /**
   * Create a new password reset token
   * @param {PasswordResetToken} passwordResetToken
   * @returns {Promise<PasswordResetToken>}
   */
  async create(passwordResetToken) {
    throw new Error('Method not implemented');
  }

  /**
   * Delete password reset token by user ID
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async deleteByUserId(userId) {
    throw new Error('Method not implemented');
  }

  /**
   * Delete password reset token by token string
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async deleteByToken(token) {
    throw new Error('Method not implemented');
  }
}

export default IPasswordResetTokenRepository;
