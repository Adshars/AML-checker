import * as AuthService from '../services/authService.js';
import logger from '../utils/logger.js';
import { registerOrgSchema, registerUserSchema, loginSchema, resetPasswordSchema } from '../utils/validationSchemas.js';

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
    const { error } = registerOrgSchema.validate(req.body);
    if (error) {
      logger.warn('Registration validation failed', { requestId, error: error.details[0].message });
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await AuthService.registerOrgService(req.body);

    logger.info('Organization registered successfully', {
      requestId,
      orgId: result.savedOrg._id,
      adminEmail: result.newUser.email,
    });

    res.status(201).json({
      message: 'Organization registered successfully',
      organization: {
        id: result.savedOrg._id,
        name: result.savedOrg.name,
        location: `${result.savedOrg.city}, ${result.savedOrg.country}`,
        apiKey: result.savedOrg.apiKey,
        apiSecret: result.apiSecret,
      },
      user: {
        id: result.newUser._id,
        fullName: `${result.newUser.firstName} ${result.newUser.lastName}`,
        email: result.newUser.email,
        role: result.newUser.role,
      },
    });
  } catch (error) {
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
  const userRole = req.headers['x-role'];  // ✅ Pochodzi z JWT w API Gateway
  
  try {
    // ✅ Sprawdzenie, czy user jest adminiem
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      logger.warn('Unauthorized user registration attempt', { 
        requestId, 
        attemptedBy: req.headers['x-user-id'],
        role: userRole 
      });
      return res.status(403).json({ error: 'Only admins can register new users' });
    }

    logger.info('User registration request', { requestId, by: req.headers['x-user-id'] });

    const { error } = registerUserSchema.validate(req.body);
    if (error) {
      logger.warn('User registration validation failed', { requestId, error: error.details[0].message });
      return res.status(400).json({ error: error.details[0].message });
    }

    const newUser = await AuthService.registerUserService(req.body);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser._id,
        fullName: `${newUser.firstName} ${newUser.lastName}`,
        email: newUser.email,
        role: newUser.role,
        organizationId: newUser.organizationId,
      },
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

// User Login (Updated with Refresh Token)
export const login = async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  const { error } = loginSchema.validate(req.body);
  if (error) {
    logger.warn('Login validation failed', { ip, error: error.details[0].message });
    return res.status(400).json({ error: error.details[0].message });
  }

  const { email, password } = req.body;

  try {
    logger.info('Login attempt', { email, ip });

    const result = await AuthService.loginService(email, password);
    const { user, accessToken, refreshToken } = result;

    logger.info('Login successful', {
      userId: user._id,
      role: user.role,
      orgId: user.organizationId,
    });

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: user.organizationId,
      },
    });
  } catch (error) {
    logger.warn('Login failed: Invalid credentials', { email, ip, error: error.message });
    res.status(401).json({ error: 'Invalid email or password' });
  }
};

// API Key Validation
export const validateApiKey = async (req, res) => {
  try {
    const { apiKey, apiSecret } = req.body;

    const maskedKey = apiKey ? `${apiKey.substring(0, 8)}...` : 'missing';
    logger.debug('Validating API Key', { maskedKey });

    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: 'Missing API key or secret' });
    }

    const organization = await AuthService.validateApiKeyService(apiKey, apiSecret);

    logger.debug('API Key validation successful', { orgId: organization._id });

    res.json({
      valid: true,
      organizationId: organization._id,
      organizationName: organization.name,
    });
  } catch (error) {
    logger.warn('API Key validation failed', {
      error: error.message,
      apiKey: req.body?.apiKey ? `${req.body.apiKey.substring(0, 8)}...` : 'missing',
    });
    res.status(401).json({ error: 'Invalid API key or secret' });
  }
};

// Reset Organization API Secret
export const resetOrganizationSecret = async (req, res) => {
  try {
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

    logger.info('Initiating API Secret reset', { orgId, requestedBy: userId });

    const result = await AuthService.resetSecretService(orgId);

    logger.info('API secret reset completed', { orgId });

    res.json({
      message: 'API secret reset successfully',
      apiKey: result.updatedOrg.apiKey,
      newApiSecret: result.newApiSecret,
    });
  } catch (error) {
    logger.error('Reset Secret Server Error', { orgId: req.headers['x-org-id'], error: error.message });
    res.status(500).json({ error: 'Server error' });
  }
};

// Password Reset Section
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const requestId = `forgot-${Date.now()}`;

  try {
    const result = await AuthService.requestPasswordResetService(email, requestId);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Forgot Password Error', { requestId, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const resetPassword = async (req, res) => {
  const { userId, token, newPassword } = req.body;
  const requestId = `reset-${Date.now()}`;

  const { error } = resetPasswordSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const result = await AuthService.resetPasswordService(userId, token, newPassword);
    logger.info('Password reset successful', { requestId, userId });
    res.json(result);
  } catch (err) {
    if (err.message.includes('Invalid or expired')) {
      return res.status(400).json({ error: err.message });
    }
    logger.error('Reset Password Error', { requestId, error: err.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Refresh Token and logout section
export const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return res.status(401).json({ error: 'Refresh Token required' });

  try {
    const result = await AuthService.refreshAccessTokenService(refreshToken);
    res.json(result);
  } catch (error) {
    if (error.message.includes('Invalid') || error.message.includes('logged out')) {
      logger.warn('Refresh attempt with invalid/revoked token', { error: error.message });
      return res.status(403).json({ error: error.message });
    }
    logger.error('Refresh Error', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Logout (Revoke Refresh Token)
export const logout = async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const result = await AuthService.logoutService(refreshToken);
    res.json(result);
  } catch (error) {
    logger.error('Logout Error', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};