import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../shared/errors/index.js';
import logger from '../../shared/logger/index.js';

/**
 * Token Service
 * Handles JWT token generation and verification
 */
export class TokenService {
  constructor(config, refreshTokenRepository) {
    this.jwtSecret = config.jwtSecret;
    this.jwtExpiresIn = config.jwtExpiresIn;
    this.refreshTokenSecret = config.refreshTokenSecret || config.jwtSecret;
    this.refreshTokenExpiresIn = config.refreshTokenExpiresIn;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  /**
   * Generate access token
   * @param {Object} payload - Token payload
   * @returns {string} - JWT access token
   */
  generateAccessToken(payload) {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });
  }

  /**
   * Generate refresh token
   * @param {Object} payload - Token payload
   * @returns {string} - JWT refresh token
   */
  generateRefreshToken(payload) {
    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiresIn
    });
  }

  /**
   * Verify access token
   * @param {string} token - JWT token
   * @returns {Object} - Decoded payload
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new UnauthorizedError('Invalid access token');
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - JWT refresh token
   * @returns {Object} - Decoded payload
   */
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshTokenSecret);
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  /**
   * Store refresh token
   * @param {string} token - Refresh token
   * @param {string} userId - User ID
   */
  async storeRefreshToken(token, userId) {
    await this.refreshTokenRepository.create({
      token,
      userId,
      createdAt: new Date()
    });
  }

  /**
   * Validate stored refresh token
   * @param {string} token - Refresh token
   * @returns {boolean} - True if token exists in DB
   */
  async isRefreshTokenValid(token) {
    const storedToken = await this.refreshTokenRepository.findByToken(token);
    return !!storedToken;
  }

  /**
   * Revoke refresh token
   * @param {string} token - Refresh token to revoke
   */
  async revokeRefreshToken(token) {
    await this.refreshTokenRepository.deleteByToken(token);
    logger.info('Refresh token revoked');
  }

  /**
   * Revoke all user's refresh tokens
   * @param {string} userId - User ID
   */
  async revokeAllUserTokens(userId) {
    const count = await this.refreshTokenRepository.deleteByUserId(userId);
    logger.info('All refresh tokens revoked for user', { userId, count });
  }
}

export default TokenService;
