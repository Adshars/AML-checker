import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../shared/errors/index.js';
import logger from '../../shared/logger/index.js';
import type { IRefreshTokenRepository } from '../../domain/repositories/IRefreshTokenRepository.js';
import type { RefreshToken } from '../../domain/entities/RefreshToken.js';

export interface TokenServiceConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenSecret?: string;
  refreshTokenExpiresIn: string;
}

export interface TokenPayload {
  userId?: string;
  organizationId?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  [key: string]: unknown;
}

/**
 * Token Service
 * Handles JWT token generation and verification
 */
export class TokenService {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenSecret: string;
  refreshTokenExpiresIn: string;
  refreshTokenRepository: IRefreshTokenRepository;

  constructor(config: TokenServiceConfig, refreshTokenRepository: IRefreshTokenRepository) {
    this.jwtSecret = config.jwtSecret;
    this.jwtExpiresIn = config.jwtExpiresIn;
    this.refreshTokenSecret = config.refreshTokenSecret || config.jwtSecret;
    this.refreshTokenExpiresIn = config.refreshTokenExpiresIn;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  /**
   * Generate access token
   */
  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiresIn
    } as jwt.SignOptions);
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as TokenPayload;
    } catch (error) {
      throw new UnauthorizedError('Invalid access token');
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.refreshTokenSecret) as TokenPayload;
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  /**
   * Store refresh token
   */
  async storeRefreshToken(token: string, userId: string): Promise<void> {
    await this.refreshTokenRepository.create({
      token,
      userId,
      createdAt: new Date()
    } as RefreshToken);
  }

  /**
   * Validate stored refresh token
   * @returns True if token exists in DB
   */
  async isRefreshTokenValid(token: string): Promise<boolean> {
    const storedToken = await this.refreshTokenRepository.findByToken(token);
    return !!storedToken;
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(token: string): Promise<void> {
    await this.refreshTokenRepository.deleteByToken(token);
    logger.info('Refresh token revoked');
  }

  /**
   * Revoke all user's refresh tokens
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    const count = await this.refreshTokenRepository.deleteByUserId(userId);
    logger.info('All refresh tokens revoked for user', { userId, count });
  }
}

export default TokenService;
