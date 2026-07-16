import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../shared/errors/index.js';
import logger from '../../shared/logger/index.js';
/**
 * Token Service
 * Handles JWT token generation and verification
 */
export class TokenService {
    jwtSecret;
    jwtExpiresIn;
    refreshTokenSecret;
    refreshTokenExpiresIn;
    refreshTokenRepository;
    constructor(config, refreshTokenRepository) {
        this.jwtSecret = config.jwtSecret;
        this.jwtExpiresIn = config.jwtExpiresIn;
        this.refreshTokenSecret = config.refreshTokenSecret || config.jwtSecret;
        this.refreshTokenExpiresIn = config.refreshTokenExpiresIn;
        this.refreshTokenRepository = refreshTokenRepository;
    }
    /**
     * Generate access token
     */
    generateAccessToken(payload) {
        return jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiresIn
        });
    }
    /**
     * Generate refresh token
     */
    generateRefreshToken(payload) {
        return jwt.sign(payload, this.refreshTokenSecret, {
            expiresIn: this.refreshTokenExpiresIn
        });
    }
    /**
     * Verify access token
     */
    verifyAccessToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        }
        catch (error) {
            throw new UnauthorizedError('Invalid access token');
        }
    }
    /**
     * Verify refresh token
     */
    verifyRefreshToken(token) {
        try {
            return jwt.verify(token, this.refreshTokenSecret);
        }
        catch (error) {
            throw new UnauthorizedError('Invalid refresh token');
        }
    }
    /**
     * Store refresh token
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
     * @returns True if token exists in DB
     */
    async isRefreshTokenValid(token) {
        const storedToken = await this.refreshTokenRepository.findByToken(token);
        return !!storedToken;
    }
    /**
     * Revoke refresh token
     */
    async revokeRefreshToken(token) {
        await this.refreshTokenRepository.deleteByToken(token);
        logger.info('Refresh token revoked');
    }
    /**
     * Revoke all user's refresh tokens
     */
    async revokeAllUserTokens(userId) {
        const count = await this.refreshTokenRepository.deleteByUserId(userId);
        logger.info('All refresh tokens revoked for user', { userId, count });
    }
}
export default TokenService;
