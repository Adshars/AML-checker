import { ConflictError, NotFoundError, UnauthorizedError } from '../../shared/errors/index.js';
import { Organization } from '../../domain/entities/Organization.js';
import { User } from '../../domain/entities/User.js';
import logger from '../../shared/logger/index.js';

/**
 * Organization Service
 * Handles organization registration, API key management
 */
export class OrganizationService {
  constructor(
    organizationRepository,
    userRepository,
    hashingService,
    emailService,
    config
  ) {
    this.organizationRepository = organizationRepository;
    this.userRepository = userRepository;
    this.hashingService = hashingService;
    this.emailService = emailService;
    this.config = config;
  }

  /**
   * Register a new organization with admin user
   * @param {RegisterOrgRequestDto} registerDto
   * @returns {Promise<Object>}
   */
  async registerOrganization(registerDto) {
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
    const existingOrg = await this.organizationRepository.findByName(orgName);
    if (existingOrg) {
      throw new ConflictError('Organization name already exists');
    }

    // Check if email already registered
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Generate API credentials
    const apiKey = this.hashingService.generateApiKey();
    const apiSecret = this.hashingService.generateApiSecret();
    const apiSecretHash = await this.hashingService.hash(apiSecret);

    // Create organization
    const organization = new Organization({
      name: orgName,
      country,
      city,
      address,
      apiKey,
      apiSecretHash
    });

    const savedOrg = await this.organizationRepository.create(organization);

    // Hash admin password
    const passwordHash = await this.hashingService.hash(password);

    // Create admin user
    const adminUser = new User({
      email,
      passwordHash,
      firstName,
      lastName,
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
   * @param {string} organizationId
   * @param {string} userId - User requesting the reset
   * @param {string} password - User's password for verification
   * @returns {Promise<Object>}
   */
  async resetSecret(organizationId, userId, password) {
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
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getOrganizationKeys(organizationId) {
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
   * @param {string} email
   * @param {string} firstName
   * @param {string} role
   */
  async sendWelcomeEmailAsync(email, firstName, role) {
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
        error: error.message
      });
    }
  }
}

export default OrganizationService;
