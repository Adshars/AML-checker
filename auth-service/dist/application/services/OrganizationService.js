import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../../shared/errors/index.js';
import { Organization } from '../../domain/entities/Organization.js';
import { hasAnyService } from '../../domain/entities/OrganizationServices.js';
import { User } from '../../domain/entities/User.js';
import { OrganizationSummaryDto } from '../dtos/responses/OrganizationSummaryDto.js';
import logger from '../../shared/logger/index.js';
export const DEFAULT_ORGANIZATIONS_LIMIT = 20;
export const MAX_ORGANIZATIONS_LIMIT = 100;
const NO_SERVICE_MESSAGE = 'At least one service must be enabled';
const toPositiveInt = (value, fallback) => Number.isInteger(value) && value > 0 ? value : fallback;
/**
 * Organization Service
 * Handles organization registration, API key management
 */
export class OrganizationService {
    organizationRepository;
    userRepository;
    hashingService;
    emailService;
    config;
    constructor(organizationRepository, userRepository, hashingService, emailService, config) {
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.hashingService = hashingService;
        this.emailService = emailService;
        this.config = config;
    }
    /**
     * Register a new organization with admin user
     */
    async registerOrganization(registerDto) {
        const { orgName, country, city, address, email, password, firstName, lastName, services } = registerDto;
        if (!hasAnyService(services)) {
            throw new ValidationError(NO_SERVICE_MESSAGE);
        }
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
            country: country,
            city: city,
            address: address,
            apiKey,
            apiSecretHash,
            services
        });
        const savedOrg = await this.organizationRepository.create(organization);
        // Hash admin password
        const passwordHash = await this.hashingService.hash(password);
        // Create admin user
        const adminUser = new User({
            email: email,
            passwordHash,
            firstName: firstName,
            lastName: lastName,
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
     * List organizations with user counts (SuperAdmin)
     */
    async listOrganizations({ search, page, limit } = {}) {
        const safePage = toPositiveInt(page, 1);
        const safeLimit = Math.min(toPositiveInt(limit, DEFAULT_ORGANIZATIONS_LIMIT), MAX_ORGANIZATIONS_LIMIT);
        const trimmedSearch = search?.trim() || undefined;
        const { items, total } = await this.organizationRepository.findAll({
            search: trimmedSearch,
            page: safePage,
            limit: safeLimit
        });
        const counts = await this.userRepository.countByOrganizationIds(items.map(org => org.id).filter((id) => !!id));
        return {
            data: items.map(org => OrganizationSummaryDto.fromEntity(org, counts[org.id] ?? 0)),
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
    async getOrganization(id) {
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
    async updateServices(id, services) {
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
    async sendWelcomeEmailAsync(email, firstName, role) {
        try {
            await this.emailService.sendWelcomeEmail(email, firstName, role, this.config.frontendUrl);
        }
        catch (error) {
            logger.error('Failed to send welcome email', {
                email,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}
export default OrganizationService;
