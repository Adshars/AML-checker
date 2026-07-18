import type { RefreshToken } from '../entities/RefreshToken.js';

/**
 * RefreshToken Repository Interface
 * Defines the contract for refresh token data access
 */
export class IRefreshTokenRepository {
  /**
   * Find refresh token by token string
   */
  async findByToken(token: string): Promise<RefreshToken | null> {
    throw new Error('Method not implemented');
  }

  /**
   * Find all refresh tokens by user ID
   */
  async findByUserId(userId: string): Promise<RefreshToken[]> {
    throw new Error('Method not implemented');
  }

  /**
   * Create a new refresh token
   */
  async create(refreshToken: RefreshToken): Promise<RefreshToken> {
    throw new Error('Method not implemented');
  }

  /**
   * Delete refresh token by token string
   */
  async deleteByToken(token: string): Promise<boolean> {
    throw new Error('Method not implemented');
  }

  /**
   * Delete all refresh tokens for a user
   * @returns Number of deleted tokens
   */
  async deleteByUserId(userId: string): Promise<number> {
    throw new Error('Method not implemented');
  }
}

export default IRefreshTokenRepository;
