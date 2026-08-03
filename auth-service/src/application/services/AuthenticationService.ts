import { UnauthorizedError, NotFoundError } from '../../shared/errors/index.js';
import { LoginResponseDto } from '../dtos/responses/LoginResponseDto.js';
import logger from '../../shared/logger/index.js';
import type { IUserRepository } from '../../domain/repositories/IUserRepository.js';
import type { IOrganizationRepository } from '../../domain/repositories/IOrganizationRepository.js';
import type { TokenService, TokenPayload } from './TokenService.js';
import type { BcryptHashingService } from '../../infrastructure/services/BcryptHashingService.js';
import type { LoginRequestDto } from '../dtos/requests/LoginRequestDto.js';

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiKeyValidationResult {
  organizationId?: string;
  name: string;
}

/**
 * Authentication Service
 * Handles login, logout, token refresh, and API key validation
 */
export class AuthenticationService {
  userRepository: IUserRepository;
  organizationRepository: IOrganizationRepository;
  tokenService: TokenService;
  hashingService: BcryptHashingService;

  constructor(
    userRepository: IUserRepository,
    organizationRepository: IOrganizationRepository,
    tokenService: TokenService,
    hashingService: BcryptHashingService
  ) {
    this.userRepository = userRepository;
    this.organizationRepository = organizationRepository;
    this.tokenService = tokenService;
    this.hashingService = hashingService;
  }

  /**
   * Authenticate user with email and password
   */
  async login(loginDto: LoginRequestDto): Promise<LoginResponseDto> {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.userRepository.findByEmail(email as string);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isMatch = await this.hashingService.compare(password as string, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const tokenPayload: TokenPayload = {
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
    await this.tokenService.storeRefreshToken(refreshToken, user.id as string);

    logger.info('User logged in', { userId: user.id, role: user.role });

    const organization = await this.organizationRepository.findById(user.organizationId as string);

    return LoginResponseDto.create(user, accessToken, refreshToken, organization?.name);
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<RefreshedTokens> {
    // Check if token is in DB (not revoked)
    const isValid = await this.tokenService.isRefreshTokenValid(refreshToken);
    if (!isValid) {
      throw new UnauthorizedError('Invalid Refresh Token (logged out?)');
    }

    // Verify token cryptographically
    const decoded = this.tokenService.verifyRefreshToken(refreshToken);

    // Fetch user (role might have changed)
    const user = await this.userRepository.findById(decoded.userId as string);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Token rotation: revoke old, issue new
    await this.tokenService.revokeRefreshToken(refreshToken);

    const tokenPayload: TokenPayload = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    };

    const newAccessToken = this.tokenService.generateAccessToken(tokenPayload);
    const newRefreshToken = this.tokenService.generateRefreshToken({ userId: user.id });
    await this.tokenService.storeRefreshToken(newRefreshToken, user.id as string);

    logger.info('Tokens refreshed (rotation)', { userId: user.id });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout user by revoking refresh token
   */
  async logout(refreshToken: string): Promise<{ message: string }> {
    await this.tokenService.revokeRefreshToken(refreshToken);
    logger.info('User logged out (Refresh Token revoked)');
    return { message: 'Logged out successfully' };
  }

  /**
   * Validate API key and secret for B2B authentication
   */
  async validateApiKey(apiKey: string, apiSecret: string): Promise<ApiKeyValidationResult> {
    // Find organization by apiKey
    const organization = await this.organizationRepository.findByApiKey(apiKey);
    if (!organization) {
      throw new UnauthorizedError('Invalid API Key or Secret');
    }

    // Verify apiSecret
    const isMatch = await this.hashingService.compare(apiSecret, organization.apiSecretHash as string);
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
