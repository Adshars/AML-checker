import { ConflictError, NotFoundError, UnauthorizedError } from '../../shared/errors/index.js';
import { User } from '../../domain/entities/User.js';
import { UserResponseDto } from '../dtos/responses/UserResponseDto.js';
import logger from '../../shared/logger/index.js';
/**
 * User Service
 * Handles user management operations
 */
export class UserService {
    userRepository;
    organizationRepository;
    hashingService;
    emailService;
    config;
    constructor(userRepository, organizationRepository, hashingService, emailService, config) {
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
        this.hashingService = hashingService;
        this.emailService = emailService;
        this.config = config;
    }
    /**
     * Register a new user within an organization
     */
    async registerUser(registerDto) {
        const { email, password, firstName, lastName, organizationId } = registerDto;
        // Verify organization exists
        const organization = await this.organizationRepository.findById(organizationId);
        if (!organization) {
            throw new NotFoundError('Organization does not exist');
        }
        // Check for duplicate email
        const existingUser = await this.userRepository.findByEmail(email);
        if (existingUser) {
            throw new ConflictError('Email already registered');
        }
        // Hash password
        const passwordHash = await this.hashingService.hash(password);
        // Create user with forced 'user' role
        const user = new User({
            email: email,
            passwordHash,
            firstName: firstName,
            lastName: lastName,
            organizationId,
            role: User.ROLES.USER
        });
        const savedUser = await this.userRepository.create(user);
        logger.info('User registered', {
            userId: savedUser.id,
            organizationId,
            role: savedUser.role
        });
        return UserResponseDto.fromEntity(savedUser);
    }
    /**
     * Get all users in an organization (excludes admins)
     */
    async getUsersByOrganization(organizationId) {
        const users = await this.userRepository.findByOrganizationId(organizationId, {
            excludeRoles: [User.ROLES.ADMIN, User.ROLES.SUPERADMIN],
            excludeFields: ['passwordHash']
        });
        return UserResponseDto.fromEntities(users);
    }
    /**
     * Delete a user
     * @param userId - User to delete
     * @param requesterId - User making the request
     * @param requesterRole - Role of the requester
     * @param requesterOrgId - Organization of the requester
     */
    async deleteUser(userId, requesterId, requesterRole, requesterOrgId) {
        // Prevent self-deletion
        if (userId === requesterId) {
            throw new UnauthorizedError('Cannot delete yourself');
        }
        // Find user to delete
        const userToDelete = await this.userRepository.findById(userId);
        if (!userToDelete) {
            throw new NotFoundError('User not found');
        }
        // Verify user belongs to same organization (unless superadmin)
        if (requesterRole !== User.ROLES.SUPERADMIN) {
            if (userToDelete.organizationId !== requesterOrgId) {
                throw new UnauthorizedError('Cannot delete user from different organization');
            }
            // Admin cannot delete other admins
            if (userToDelete.role === User.ROLES.ADMIN) {
                throw new UnauthorizedError('Only superadmin can delete admins');
            }
        }
        await this.userRepository.delete(userId);
        logger.info('User deleted', {
            deletedUserId: userId,
            deletedBy: requesterId
        });
        return { message: 'User deleted successfully' };
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
export default UserService;
