import logger from '../../shared/logger/index.js';
import { RegisterOrgRequestDto } from '../../application/dtos/requests/RegisterOrgRequestDto.js';

/**
 * Organization Controller
 * Handles organization registration and API key management
 */
export class OrganizationController {
  constructor(organizationService) {
    this.organizationService = organizationService;
  }

  /**
   * Register new organization with admin user
   * POST /auth/register-organization
   */
  registerOrganization = async (req, res) => {
    const requestId = `reg-${Date.now()}`;

    // Security: Only SuperAdmin can create new organizations
    const requesterRole = req.headers['x-role'];
    if (requesterRole !== 'superadmin') {
      logger.warn('Unauthorized org registration attempt', {
        requestId,
        role: requesterRole
      });
      return res.status(403).json({ error: 'Only SuperAdmin can register organizations' });
    }

    try {
      const registerDto = RegisterOrgRequestDto.fromRequest(req.body);
      const result = await this.organizationService.registerOrganization(registerDto);

      // Send welcome email (non-blocking)
      this.organizationService.sendWelcomeEmailAsync(
        result.user.email,
        result.user.firstName,
        'admin'
      );

      logger.info('Organization registered successfully', {
        requestId,
        orgId: result.organization.id,
        adminEmail: result.user.email
      });

      res.status(201).json({
        message: 'Organization registered successfully',
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          location: `${result.organization.city}, ${result.organization.country}`,
          apiKey: result.apiKey,
          apiSecret: result.apiSecret
        },
        user: {
          id: result.user.id,
          fullName: `${result.user.firstName} ${result.user.lastName}`,
          email: result.user.email,
          role: result.user.role
        }
      });
    } catch (error) {
      if (error.code === 'CONFLICT' || error.message.includes('exists') || error.message.includes('registered')) {
        logger.warn('Registration failed: Duplicate entity', { requestId, error: error.message });
        return res.status(400).json({ error: error.message });
      }
      logger.error('Registration server error', { requestId, error: error.message, stack: error.stack });
      res.status(500).json({ error: 'Server error during registration' });
    }
  };

  /**
   * Reset organization API secret
   * POST /auth/reset-secret
   */
  resetOrganizationSecret = async (req, res) => {
    try {
      const orgId = req.headers['x-org-id'];
      const role = req.headers['x-role'];
      const userId = req.headers['x-user-id'];
      const { password } = req.body || {};

      if (!orgId || !userId) {
        logger.warn('Unauthorized reset secret attempt', { ip: req.ip });
        return res.status(401).json({ error: 'Unauthorized: Missing context' });
      }

      if (role !== 'admin') {
        logger.warn('Forbidden reset secret attempt', { userId, orgId, role, ip: req.ip });
        return res.status(403).json({ error: 'Forbidden: Admins only' });
      }

      if (!password) {
        logger.warn('Reset secret missing password', { userId, orgId });
        return res.status(400).json({ error: 'Password is required' });
      }

      logger.info('Initiating API Secret reset', { orgId, requestedBy: userId });

      const result = await this.organizationService.resetSecret(orgId, userId, password);

      logger.info('API secret reset completed', { orgId });

      res.json({
        message: 'API secret reset successfully',
        apiKey: result.organization.apiKey,
        newApiSecret: result.apiSecret
      });
    } catch (error) {
      if (error.code === 'UNAUTHORIZED') {
        return res.status(403).json({ error: 'Incorrect password' });
      }
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      logger.error('Reset Secret Server Error', {
        orgId: req.headers['x-org-id'],
        error: error.message
      });
      res.status(500).json({ error: 'Server error' });
    }
  };

  /**
   * Get organization public API key
   * GET /auth/organization/keys
   */
  getOrganizationKeys = async (req, res) => {
    try {
      const orgId = req.headers['x-org-id'];
      const userId = req.headers['x-user-id'];

      if (!orgId || !userId) {
        return res.status(401).json({ error: 'Unauthorized: Missing context' });
      }

      const result = await this.organizationService.getOrganizationKeys(orgId);

      return res.json({ apiKey: result.apiKey });
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Organization not found' });
      }
      logger.error('Get Organization Keys Error', { error: error.message });
      return res.status(500).json({ error: 'Server error' });
    }
  };
}

export default OrganizationController;
