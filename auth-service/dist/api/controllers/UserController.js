import logger from '../../shared/logger/index.js';
import { RegisterUserRequestDto } from '../../application/dtos/requests/RegisterUserRequestDto.js';
/**
 * User Controller
 * Handles user management operations
 */
export class UserController {
    userService;
    constructor(userService) {
        this.userService = userService;
    }
    /**
     * Register new user (Admin endpoint)
     * POST /auth/register-user
     */
    registerUser = async (req, res) => {
        const requestId = `user-reg-${Date.now()}`;
        const userRole = req.headers['x-role'];
        try {
            // Check if user is admin
            if (userRole !== 'admin' && userRole !== 'superadmin') {
                logger.warn('Unauthorized user registration attempt', {
                    requestId,
                    attemptedBy: req.headers['x-user-id'],
                    role: userRole
                });
                res.status(403).json({ error: 'Only admins can register new users' });
                return;
            }
            logger.info('User registration request', { requestId, by: req.headers['x-user-id'] });
            const registerDto = RegisterUserRequestDto.fromRequest(req.body, req.body.organizationId);
            const result = await this.userService.registerUser(registerDto);
            // Send welcome email (non-blocking)
            this.userService.sendWelcomeEmailAsync(result.email, result.firstName, result.role);
            res.status(201).json({
                message: 'User registered successfully',
                user: {
                    id: result.id,
                    fullName: `${result.firstName} ${result.lastName}`,
                    email: result.email,
                    role: result.role,
                    organizationId: result.organizationId
                }
            });
        }
        catch (error) {
            const err = error;
            const message = err.message || '';
            if (err.code === 'NOT_FOUND') {
                logger.warn('User registration failed', { requestId, reason: message });
                res.status(404).json({ error: message });
                return;
            }
            if (err.code === 'CONFLICT' || message.includes('registered')) {
                logger.warn('User registration failed', { requestId, reason: message });
                res.status(400).json({ error: message });
                return;
            }
            logger.error('User registration server error', { requestId, error: message });
            res.status(500).json({ error: 'Server error during user registration' });
        }
    };
    /**
     * Get all users for organization
     * GET /users
     */
    getUsers = async (req, res) => {
        const requestId = `users-list-${Date.now()}`;
        const orgId = req.headers['x-org-id'];
        const userRole = req.headers['x-role'];
        try {
            // Security: Only admins and superadmins can access this endpoint
            if (userRole !== 'admin' && userRole !== 'superadmin') {
                logger.warn('Unauthorized users list access attempt', { requestId, role: userRole });
                res.status(403).json({ error: 'Access denied: Admins only' });
                return;
            }
            if (!orgId) {
                logger.warn('Missing organization context for users list', { requestId });
                res.status(403).json({ error: 'Missing organization context' });
                return;
            }
            logger.info('Fetching users list', { requestId, orgId });
            const users = await this.userService.getUsersByOrganization(orgId);
            logger.info('Users list retrieved', { requestId, count: users.length });
            res.json({
                data: users.map(user => ({
                    id: user?.id,
                    email: user?.email,
                    firstName: user?.firstName,
                    lastName: user?.lastName,
                    role: user?.role,
                    createdAt: user?.createdAt
                }))
            });
        }
        catch (error) {
            const err = error;
            logger.error('Users list retrieval error', { requestId, error: err.message });
            res.status(500).json({ error: 'Server error while fetching users' });
        }
    };
    /**
     * Create new user in organization
     * POST /users
     */
    createUser = async (req, res) => {
        const requestId = `user-create-${Date.now()}`;
        const orgId = req.headers['x-org-id'];
        const userRole = req.headers['x-role'];
        const adminUserId = req.headers['x-user-id'];
        try {
            // Security: Only admins and superadmins can create users
            if (userRole !== 'admin' && userRole !== 'superadmin') {
                logger.warn('Unauthorized user creation attempt', { requestId, role: userRole });
                res.status(403).json({ error: 'Access denied: Admins only' });
                return;
            }
            if (!orgId) {
                logger.warn('Missing organization context for user creation', { requestId });
                res.status(403).json({ error: 'Missing organization context' });
                return;
            }
            logger.info('Creating new user', {
                requestId,
                email: req.body.email,
                by: adminUserId,
                adminRole: userRole
            });
            // Force organizationId from admin's context
            const registerDto = RegisterUserRequestDto.fromRequest(req.body, orgId);
            const result = await this.userService.registerUser(registerDto);
            // Send welcome email (non-blocking)
            this.userService.sendWelcomeEmailAsync(result.email, result.firstName, result.role);
            logger.info('User created successfully', {
                requestId,
                newUserId: result.id,
                email: result.email,
                role: result.role
            });
            res.status(201).json({
                message: 'User created successfully',
                user: {
                    id: result.id,
                    email: result.email,
                    firstName: result.firstName,
                    lastName: result.lastName,
                    role: result.role,
                    organizationId: result.organizationId,
                    createdAt: result.createdAt
                }
            });
        }
        catch (error) {
            const err = error;
            const message = err.message || '';
            if (err.code === 'CONFLICT' || message.includes('registered')) {
                logger.warn('User creation failed: Email already exists', { requestId, email: req.body.email });
                res.status(400).json({ error: message });
                return;
            }
            logger.error('User creation server error', { requestId, error: message });
            res.status(500).json({ error: 'Server error during user creation' });
        }
    };
    /**
     * Delete user from organization
     * DELETE /users/:id
     */
    deleteUser = async (req, res) => {
        const requestId = `user-delete-${Date.now()}`;
        const orgId = req.headers['x-org-id'];
        const userRole = req.headers['x-role'];
        const adminUserId = req.headers['x-user-id'];
        const id = req.params.id;
        try {
            // Security: Only admins and superadmins can delete users
            if (userRole !== 'admin' && userRole !== 'superadmin') {
                logger.warn('Unauthorized user deletion attempt', { requestId, role: userRole });
                res.status(403).json({ error: 'Access denied: Admins only' });
                return;
            }
            if (!orgId) {
                logger.warn('Missing organization context for user deletion', { requestId });
                res.status(403).json({ error: 'Missing organization context' });
                return;
            }
            // Prevent self-deletion
            if (id === adminUserId) {
                logger.warn('Admin attempted to delete themselves', { requestId, userId: id });
                res.status(400).json({ error: 'Cannot delete your own account' });
                return;
            }
            logger.info('Deleting user', { requestId, userId: id, by: adminUserId });
            const result = await this.userService.deleteUser(id, adminUserId, userRole, orgId);
            logger.info('User deleted successfully', { requestId, userId: id });
            res.json(result);
        }
        catch (error) {
            const err = error;
            if (err.code === 'NOT_FOUND') {
                logger.warn('User deletion failed: User not found', { requestId, userId: id });
                res.status(404).json({ error: 'User not found' });
                return;
            }
            if (err.code === 'UNAUTHORIZED') {
                logger.warn('User deletion unauthorized', { requestId, userId: id, reason: err.message });
                res.status(403).json({ error: err.message });
                return;
            }
            logger.error('User deletion server error', { requestId, error: err.message });
            res.status(500).json({ error: 'Server error during user deletion' });
        }
    };
}
export default UserController;
