import { ConflictError, NotFoundError, UnauthorizedError } from '../../shared/errors/index.js';
import { Organization } from '../../domain/entities/Organization.js';
import { User } from '../../domain/entities/User.js';
import logger from '../../shared/logger/index.js';
import type { IOrganizationRepository } from '../../domain/repositories/IOrganizationRepository.js';
import type { IUserRepository } from '../../domain/repositories/IUserRepository.js';
import type { BcryptHashingService } from '../../infrastructure/services/BcryptHashingService.js';
import type { NodemailerEmailService } from '../../infrastructure/services/NodemailerEmailService.js';
import type { AppConfig } from '../../shared/config/index.js';
import type { RegisterOrgRequestDto } from '../dtos/requests/RegisterOrgRequestDto.js';

export interface RegisterOrganizationResult {
  organization: Organization;
  user: User;
  apiKey: string;
  apiSecret: string;
}

export interface ResetSecretResult {
  organization: Organization;
  apiSecret: string;
}

/**
 * Organization Service
 * Handles organization registration, API key management
 */
export class OrganizationService {
  organizationRepository: IOrganizationRepository;
  userRepository: IUserRepository;
  hashingService: BcryptHashingService;
  emailService: NodemailerEmailService;
  config: AppConfig;

  constructor(
    organizationRepository: IOrganizationRepository,
    userRepository: IUserRepository,
    hashingService: BcryptHashingService,
    emailService: NodemailerEmailService,
    config: AppConfig
  ) {
    this.organizationRepository = organizationRepository;
    this.userRepository = userRepository;
    this.hashingService = hashingService;
    this.emailService = emailService;
    this.config = config;
  }

  /**
   * Register a new organization with admin user
   */
  async registerOrganization(registerDto: RegisterOrgRequestDto): Promise<RegisterOrganizationResult> {
    const {
      orgName,
      country,
      city,
      address,
      email,
      password,
      firstName,
      lastName
    } = registerDto;

    // Check for duplicate organization name
    const existingOrg = await this.organizationRepository.findByName(orgName as string);
    if (existingOrg) {
      throw new ConflictError('Organization name already exists');
    }

    // Check if email already registered
    const existingUser = await this.userRepository.findByEmail(email as string);
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Generate API credentials
    const apiKey = this.hashingService.generateApiKey();
    const apiSecret = this.hashingService.generateApiSecret();
    const apiSecretHash = await this.hashingService.hash(apiSecret);

    // Create organization
    const organization = new Organization({
      name: orgName as string,
      country: country as string,
      city: city as string,
      address: address as string,
      apiKey,
      apiSecretHash
    });

    const savedOrg = await this.organizationRepository.create(organization);

    // Hash admin password
    const passwordHash = await this.hashingService.hash(password as string);

    // Create admin user
    const adminUser = new User({
      email: email as string,
      passwordHash,
      firstName: firstName as string,
      lastName: lastName as string,
      organizationId: savedOrg.id,
      role: User.ROLES.ADMIN
    });

    const savedUser = await this.userRepository.create(adminUser);

    logger.info('Organization registered', {
      organizationId: savedOrg.id,
      adminUserId: savedUser.id
    });

    return {
      organization: savedOrg,
      user: savedUser,
      apiKey,
      apiSecret
    };
  }

  /**
   * Reset organization API secret
   * @param userId - User requesting the reset
   * @param password - User's password for verification
   */
  async resetSecret(organizationId: string, userId: string, password: string): Promise<ResetSecretResult> {
    // Verify user password
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isMatch = await this.hashingService.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid password');
    }

    // Generate new secret
    const newApiSecret = this.hashingService.generateApiSecret();
    const newApiSecretHash = await this.hashingService.hash(newApiSecret);

    // Update organization
    const updatedOrg = await this.organizationRepository.update(organizationId, {
      apiSecretHash: newApiSecretHash
    });

    if (!updatedOrg) {
      throw new NotFoundError('Organization not found');
    }

    logger.info('API Secret reset', {
      organizationId,
      initiatedBy: userId
    });

    return {
      organization: updatedOrg,
      apiSecret: newApiSecret
    };
  }

  /**
   * Get organization API keys (public key only)
   */
  async getOrganizationKeys(organizationId: string): Promise<{ apiKey?: string | null }> {
    const organization = await this.organizationRepository.findById(organizationId);
    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    return {
      apiKey: organization.apiKey
    };
  }

  /**
   * Send welcome email (non-blocking)
   */
  async sendWelcomeEmailAsync(email: string, firstName: string, role: string): Promise<void> {
    try {
      await this.emailService.sendWelcomeEmail(
        email,
        firstName,
        role,
        this.config.frontendUrl
      );
    } catch (error) {
      logger.error('Failed to send welcome email', {
        email,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export default OrganizationService;
