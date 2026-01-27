import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';
import { registerUserSchema } from '../utils/validationSchemas.js';

/**
 * Get all users for the authenticated admin's organization
 */
export const getUsers = async (req, res) => {
  const requestId = `users-list-${Date.now()}`;
  const orgId = req.headers['x-org-id'];
  const userRole = req.headers['x-role'];

  try {
    // Security: Only admins and superadmins can access this endpoint
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      logger.warn('Unauthorized users list access attempt', { requestId, role: userRole });
      return res.status(403).json({ error: 'Access denied: Admins only' });
    }

    if (!orgId) {
      logger.warn('Missing organization context for users list', { requestId });
      return res.status(403).json({ error: 'Missing organization context' });
    }

    logger.info('Fetching users list', { requestId, orgId });

    // Fetch only regular users (hide admins/superadmins) from the same organization
    const users = await User.find({ organizationId: orgId, role: 'user' })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    logger.info('Users list retrieved', { requestId, count: users.length });

    res.json({
      data: users.map(user => ({
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    logger.error('Users list retrieval error', { requestId, error: error.message });
    res.status(500).json({ error: 'Server error while fetching users' });
  }
};

/**
 * Create a new user in the authenticated admin's organization
 */
export const createUser = async (req, res) => {
  const requestId = `user-create-${Date.now()}`;
  const orgId = req.headers['x-org-id'];
  const userRole = req.headers['x-role'];
  const adminUserId = req.headers['x-user-id'];

  try {
    // Security: Only admins and superadmins can create users
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      logger.warn('Unauthorized user creation attempt', { requestId, role: userRole });
      return res.status(403).json({ error: 'Access denied: Admins only' });
    }

    if (!orgId) {
      logger.warn('Missing organization context for user creation', { requestId });
      return res.status(403).json({ error: 'Missing organization context' });
    }

    // Validate request body
    const { error } = registerUserSchema.validate(req.body);
    if (error) {
      logger.warn('User creation validation failed', { requestId, error: error.details[0].message });
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password, firstName, lastName } = req.body;

    // CRITICAL SECURITY FIX: Force role to 'user' - ignore any role sent from frontend
    // Regular admins can ONLY create regular users, never other admins
    const role = 'user';

    logger.info('Creating new user', { 
      requestId, 
      email, 
      role, // Will always be 'user'
      by: adminUserId,
      adminRole: userRole
    });

    // Check for duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn('User creation failed: Email already exists', { requestId, email });
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user with enforced organizationId from admin's context
    // and FORCED role 'user'
    const newUser = new User({
      email,
      passwordHash,
      firstName,
      lastName,
      organizationId: orgId, // Force same organization as admin
      role // Always 'user' - hardcoded above
    });

    await newUser.save();

    logger.info('User created successfully', { 
      requestId, 
      newUserId: newUser._id,
      email: newUser.email,
      role: newUser.role // Log for audit
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role, // Will be 'user'
        organizationId: newUser.organizationId,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    logger.error('User creation server error', { requestId, error: error.message });
    res.status(500).json({ error: 'Server error during user creation' });
  }
};

/**
 * Delete a user from the authenticated admin's organization
 */
export const deleteUser = async (req, res) => {
  const requestId = `user-delete-${Date.now()}`;
  const orgId = req.headers['x-org-id'];
  const userRole = req.headers['x-role'];
  const adminUserId = req.headers['x-user-id'];
  const { id } = req.params;

  try {
    // Security: Only admins and superadmins can delete users
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      logger.warn('Unauthorized user deletion attempt', { requestId, role: userRole });
      return res.status(403).json({ error: 'Access denied: Admins only' });
    }

    if (!orgId) {
      logger.warn('Missing organization context for user deletion', { requestId });
      return res.status(403).json({ error: 'Missing organization context' });
    }

    // Prevent self-deletion
    if (id === adminUserId) {
      logger.warn('Admin attempted to delete themselves', { requestId, userId: id });
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    logger.info('Deleting user', { requestId, userId: id, by: adminUserId });

    // Find user and verify they belong to the same organization
    const userToDelete = await User.findById(id);

    if (!userToDelete) {
      logger.warn('User deletion failed: User not found', { requestId, userId: id });
      return res.status(404).json({ error: 'User not found' });
    }

    // Data isolation: Verify user belongs to admin's organization
    if (userToDelete.organizationId.toString() !== orgId) {
      logger.warn('Admin attempted to delete user from different organization', { 
        requestId, 
        userId: id,
        userOrg: userToDelete.organizationId,
        adminOrg: orgId 
      });
      return res.status(403).json({ error: 'Cannot delete user from different organization' });
    }

    // Additional security: Only superadmins can delete admins
    if (userToDelete.role === 'admin' && userRole !== 'superadmin') {
      logger.warn('Non-superadmin attempted to delete admin user', { requestId, userId: id });
      return res.status(403).json({ error: 'Only superadmins can delete admin users' });
    }

    await User.findByIdAndDelete(id);

    logger.info('User deleted successfully', { requestId, userId: id, email: userToDelete.email });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('User deletion server error', { requestId, error: error.message });
    res.status(500).json({ error: 'Server error during user deletion' });
  }
};
