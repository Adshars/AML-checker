import * as AuthService from '../services/authService.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';
import PasswordResetToken from '../models/PasswordResetToken.js';
import { sendResetEmail } from '../utils/emailSender.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';


 // Registration organisation and admin user
export const registerOrganization = async (req, res) => {
  const requestId = `reg-${Date.now()}`;

  // --- New security feature ---
  // Only SuperAdmin can create new organizations
  /*
  const requesterRole = req.headers['x-role'];
  if (requesterRole !== 'superadmin') {
      logger.warn('Unauthorized org registration attempt', { requestId });
      return res.status(403).json({ error: 'Only SuperAdmin can create organizations' });
  }
  */
  // ---------------------------------

  try {
    const { 
      orgName, country, city, address, 
      email, password, firstName, lastName 
    } = req.body;

    logger.info('Organization registration request', { requestId, orgName, email, country });

    // Validation
    if (!orgName || !country || !email || !password || !firstName || !lastName) {
      logger.warn('Registration validation failed', { requestId, missingFields: true });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Call business logic from Service
    const result = await AuthService.registerOrgService(req.body);

    logger.info('Organization registered successfully', { 
        requestId, 
        orgId: result.savedOrg._id, 
        adminEmail: result.newUser.email 
    });

    // Success
    res.status(201).json({
      message: 'Organization registered successfully',
      organization: {
        id: result.savedOrg._id,
        name: result.savedOrg.name,
        location: `${result.savedOrg.city}, ${result.savedOrg.country}`,
        apiKey: result.savedOrg.apiKey,
        apiSecret: result.apiSecret // Only shown at creation
      },
      user: {
        id: result.newUser._id,
        fullName: `${result.newUser.firstName} ${result.newUser.lastName}`,
        email: result.newUser.email,
        role: result.newUser.role
      }
    });

  } catch (error) {
    // Differentiate error types
    if (error.message.includes('exists') || error.message.includes('registered')) {
        logger.warn('Registration failed: Duplicate entity', { requestId, error: error.message });
        return res.status(400).json({ error: error.message });
    }
    logger.error('Registration server error', { requestId, error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error during registration' });
  }
};

 // User Registration
export const registerUser = async (req, res) => {
  const requestId = `user-reg-${Date.now()}`;
  try {
    const { email, password, firstName, lastName, organizationId } = req.body;

    logger.info('User registration request', { requestId, email, organizationId });

    if (!email || !password || !firstName || !lastName || !organizationId) {
      logger.warn('User registration validation failed', { requestId });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newUser = await AuthService.registerUserService(req.body);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser._id,
        fullName: `${newUser.firstName} ${newUser.lastName}`,
        email: newUser.email,
        role: newUser.role,
        organizationId: newUser.organizationId
      }
    });

} catch (error) {
    if (error.message.includes('Organization does not exist') || error.message.includes('registered')) {
        logger.warn('User registration failed', { requestId, reason: error.message });
        if (error.message.includes('Organization does not exist')) return res.status(404).json({ error: error.message });
        return res.status(400).json({ error: error.message });
    }
    
    logger.error('User registration server error', { requestId, error: error.message });
    res.status(500).json({ error: 'Server error during user registration' });
  }
};

// User Login
export const login = async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const { email } = req.body;

  try {
    const { email, password } = req.body;
    logger.info('Login attempt', { email, ip });

    if (!email || !password) {
        logger.warn('Login validation failed', { ip, error: 'Missing credentials' });
        return res.status(400).json({ error: 'Missing email or password' });
    }

    const result = await AuthService.loginService(email, password);

    logger.info('Login successful', { 
        userId: result.user._id, 
        role: result.user.role, 
        orgId: result.user.organizationId 
    });

    res.json({
      message: 'Login successful',
      token: result.token,
      user: {
        id: result.user._id,
        email: result.user.email,
        role: result.user.role,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        organizationId: result.user.organizationId
      }
    });

  } catch (error) {
    logger.warn('Login failed: Invalid credentials', { email, ip });
    // Security: Always return 401 on login error
    res.status(401).json({ error: 'Invalid email or password' });
  }
};

// API Key Validation
export const validateApiKey = async (req, res) => {
  try {
    const { apiKey, apiSecret } = req.body;

    const maskedKey = apiKey ? `${apiKey.substring(0, 8)}...` : 'missing';
    logger.debug(`Validating API Key`, { maskedKey });

    if (!apiKey || !apiSecret) {
        return res.status(400).json({ error: 'Missing API key or secret' });
    }

    const organization = await AuthService.validateApiKeyService(apiKey, apiSecret);

    logger.debug('API Key validation successful', { orgId: organization._id });

    res.json({
      valid: true,
      organizationId: organization._id,
      organizationName: organization.name
    });

  } catch (error) {
    logger.warn('API Key validation failed', { error: error.message, apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : 'missing' });
    res.status(401).json({ error: 'Invalid API key or secret' });
  }
};

// Reset Organization API Secret
export const resetOrganizationSecret = async (req, res) => {
  try {
    // Data injected by API Gateway
    const orgId = req.headers['x-org-id'];
    const role = req.headers['x-role'];
    const userId = req.headers['x-user-id'];

    if (!orgId || !userId) {
      logger.warn('Unauthorized reset secret attempt', { ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized: Missing context' });
    }

    if (role !== 'admin') {
      logger.warn('Forbidden reset secret attempt', { userId, orgId, role, ip: req.ip });
      return res.status(403).json({ error: 'Forbidden: Admins only' });
    }

    logger.info(`Initiating API Secret reset`, { orgId, requestedBy: userId });

    const result = await AuthService.resetSecretService(orgId);

    logger.info('API secret reset completed', { orgId });

    res.json({
      message: 'API secret reset successfully',
      apiKey: result.updatedOrg.apiKey,
      newApiSecret: result.newApiSecret
    });

  } catch (error) {
    logger.error('Reset Secret Server Error', { orgId: req.headers['x-org-id'], error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
};

// Password Reset Section

// Forgot Password - Request Reset
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const requestId = `forgot-${Date.now()}`;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      logger.info('Forgot password request for non-existent email', { requestId, email });
        return res.status(200).json({ message: 'If a user with that email exists, a password reset link has been sent.' });
    }

    // Delete existing tokens for this user
    await PasswordResetToken.findOneAndDelete({ userId: user._id });

    // Generate token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Save token to DB
    await new PasswordResetToken({
      userId: user._id,
      token: resetToken,
    }).save();

    // Create reset link
    // In a real app, the frontend URL would be used here
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${frontendUrl}/reset-password?token=${resetToken}&id=${user._id}`;

    // Send email
    logger.info(`Sending reset email to user`, { requestId, userId: user._id });
    await sendResetEmail(user.email, link);

    res.status(200).json({ message: 'If a user with that email exists, a password reset link has been sent.' });

    } catch (error) {
    logger.error('Forgot Password Error', { requestId, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Reset Password - Using Token

export const resetPassword = async (req, res) => {
  const { userId, token, newPassword } = req.body;
  const requestId = `reset-${Date.now()}`;

  try {
    const pwdResetToken = await PasswordResetToken.findOne({ userId });

    if (!pwdResetToken) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    // Verify token
    const isValid = pwdResetToken.token === token;
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    // Update user's password
    await User.findByIdAndUpdate(userId, { 
        $set: { passwordHash: hash } 
    }, { new: true });

    // Delete the used token
    await pwdResetToken.deleteOne();

    logger.info('Password reset successful', { requestId, userId });
    res.json({ message: 'Password has been reset successfully' });

  } catch (error) {
    logger.error('Reset Password Error', { requestId, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};