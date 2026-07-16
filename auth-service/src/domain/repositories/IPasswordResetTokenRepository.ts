import type { PasswordResetToken } from '../entities/PasswordResetToken.js';

/**
 * PasswordResetToken Repository Interface
 * Defines the contract for password reset token data access
 */
export class IPasswordResetTokenRepository {
  /**
   * Find password reset token by user ID
   */
  async findByUserId(userId: string): Promise<PasswordResetToken | null> {
    throw new Error('Method not implemented');
  }

  /**
   * Find password reset token by token string
   */
  async findByToken(token: string): Promise<PasswordResetToken | null> {
    throw new Error('Method not implemented');
  }

  /**
   * Create a new password reset token
   */
  async create(passwordResetToken: PasswordResetToken): Promise<PasswordResetToken> {
    throw new Error('Method not implemented');
  }

  /**
   * Delete password reset token by user ID
   */
  async deleteByUserId(userId: string): Promise<boolean> {
    throw new Error('Method not implemented');
  }

  /**
   * Delete password reset token by token string
   */
  async deleteByToken(token: string): Promise<boolean> {
    throw new Error('Method not implemented');
  }
}

export default IPasswordResetTokenRepository;
