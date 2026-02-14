import { UnauthorizedError, NotFoundError } from '../../shared/errors/index.js';
import { LoginResponseDto } from '../dtos/responses/LoginResponseDto.js';
import logger from '../../shared/logger/index.js';

/**
 * Authentication Service
 * Handles login, logout, token refresh, and API key validation
 */
export class AuthenticationService {
  constructor(
    userRepository,
    organizationRepository,
    tokenService,
    hashingService
  ) {
    this.userRepository = userRepository;
    this.organizationRepository = organizationRepository;
    this.tokenService = tokenService;
    this.hashingService = hashingService;
  }

  /**
   * Authenticate user with email and password
   * @param {LoginRequestDto} loginDto
   * @returns {Promise<LoginResponseDto>}
   */
  async login(loginDto) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isMatch = await this.hashingService.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    };

    const accessToken = this.tokenService.generateAccessToken(tokenPayload);
    const refreshToken = this.tokenService.generateRefreshToken({ userId: user.id });

    // Store refresh token
    await this.tokenService.storeRefreshToken(refreshToken, user.id);

    logger.info('User logged in', { userId: user.id, role: user.role });

    return LoginResponseDto.create(user, accessToken, refreshToken);
  }

  /**
   * Refresh access token
   * @param {string} refreshToken
   * @returns {Promise<Object>}
   */
  async refreshAccessToken(refreshToken) {
    // Check if token is in DB (not revoked)
    const isValid = await this.tokenService.isRefreshTokenValid(refreshToken);
    if (!isValid) {
      throw new UnauthorizedError('Invalid Refresh Token (logged out?)');
    }

    // Verify token cryptographically
    const decoded = this.tokenService.verifyRefreshToken(refreshToken);

    // Fetch user (role might have changed)
    const user = await this.userRepository.findById(decoded.userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Token rotation: revoke old, issue new
    await this.tokenService.revokeRefreshToken(refreshToken);

    const tokenPayload = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    };

    const newAccessToken = this.tokenService.generateAccessToken(tokenPayload);
    const newRefreshToken = this.tokenService.generateRefreshToken({ userId: user.id });
    await this.tokenService.storeRefreshToken(newRefreshToken, user.id);

    logger.info('Tokens refreshed (rotation)', { userId: user.id });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout user by revoking refresh token
   * @param {string} refreshToken
   */
  async logout(refreshToken) {
    await this.tokenService.revokeRefreshToken(refreshToken);
    logger.info('User logged out (Refresh Token revoked)');
    return { message: 'Logged out successfully' };
  }

  /**
   * Validate API key and secret for B2B authentication
   * @param {string} apiKey
   * @param {string} apiSecret
   * @returns {Promise<Object>}
   */
  async validateApiKey(apiKey, apiSecret) {
    // Find organization by apiKey
    const organization = await this.organizationRepository.findByApiKey(apiKey);
    if (!organization) {
      throw new UnauthorizedError('Invalid API Key or Secret');
    }

    // Verify apiSecret
    const isMatch = await this.hashingService.compare(apiSecret, organization.apiSecretHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid API Key or Secret');
    }

    logger.info('API Key validated', { organizationId: organization.id });

    return {
      organizationId: organization.id,
      name: organization.name
    };
  }
}

export default AuthenticationService;
