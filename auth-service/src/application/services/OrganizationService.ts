import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../../shared/errors/index.js';
import { Organization } from '../../domain/entities/Organization.js';
import { hasAnyService, type OrganizationServices } from '../../domain/entities/OrganizationServices.js';
import { User } from '../../domain/entities/User.js';
import { OrganizationSummaryDto } from '../dtos/responses/OrganizationSummaryDto.js';
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

export interface ListOrganizationsParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListOrganizationsResult {
  data: OrganizationSummaryDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const DEFAULT_ORGANIZATIONS_LIMIT = 20;
export const MAX_ORGANIZATIONS_LIMIT = 100;

const NO_SERVICE_MESSAGE = 'At least one service must be enabled';

const toPositiveInt = (value: number | undefined, fallback: number): number =>
  Number.isInteger(value) && (value as number) > 0 ? (value as number) : fallback;

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
      lastName,
      services
    } = registerDto;

    if (!hasAnyService(services)) {
      throw new ValidationError(NO_SERVICE_MESSAGE);
    }

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
      apiSecretHash,
      services
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
   * List organizations with user counts (SuperAdmin)
   */
  async listOrganizations({ search, page, limit }: ListOrganizationsParams = {}): Promise<ListOrganizationsResult> {
    const safePage = toPositiveInt(page, 1);
    const safeLimit = Math.min(toPositiveInt(limit, DEFAULT_ORGANIZATIONS_LIMIT), MAX_ORGANIZATIONS_LIMIT);
    const trimmedSearch = search?.trim() || undefined;

    const { items, total } = await this.organizationRepository.findAll({
      search: trimmedSearch,
      page: safePage,
      limit: safeLimit
    });

    const counts = await this.userRepository.countByOrganizationIds(
      items.map(org => org.id).filter((id): id is string => !!id)
    );

    return {
      data: items.map(org => OrganizationSummaryDto.fromEntity(org, counts[org.id as string] ?? 0)),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit)
      }
    };
  }

  /**
   * Get organization details (SuperAdmin)
   */
  async getOrganization(id: string): Promise<OrganizationSummaryDto> {
    const organization = await this.organizationRepository.findById(id);
    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    const counts = await this.userRepository.countByOrganizationIds([id]);
    return OrganizationSummaryDto.fromEntity(organization, counts[id] ?? 0);
  }

  /**
   * Replace organization service package (SuperAdmin)
   */
  async updateServices(id: string, services: OrganizationServices): Promise<OrganizationSummaryDto> {
    if (!hasAnyService(services)) {
      throw new ValidationError(NO_SERVICE_MESSAGE);
    }

    const updated = await this.organizationRepository.updateServices(id, services);
    if (!updated) {
      throw new NotFoundError('Organization not found');
    }

    const counts = await this.userRepository.countByOrganizationIds([id]);
    return OrganizationSummaryDto.fromEntity(updated, counts[id] ?? 0);
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
