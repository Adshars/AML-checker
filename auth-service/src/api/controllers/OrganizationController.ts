import type { Request, Response } from 'express';
import logger from '../../shared/logger/index.js';
import { RegisterOrgRequestDto } from '../../application/dtos/requests/RegisterOrgRequestDto.js';
import type { OrganizationService } from '../../application/services/OrganizationService.js';

interface DuckTypedError {
  message?: string;
  code?: string;
  stack?: string;
}

/**
 * Organization Controller
 * Handles organization registration and API key management
 */
export class OrganizationController {
  organizationService: OrganizationService;

  constructor(organizationService: OrganizationService) {
    this.organizationService = organizationService;
  }

  /**
   * Register new organization with admin user
   * POST /auth/register-organization
   */
  registerOrganization = async (req: Request, res: Response): Promise<void> => {
    const requestId = `reg-${Date.now()}`;

    // Security: Only SuperAdmin can create new organizations
    const requesterRole = req.headers['x-role'];
    if (requesterRole !== 'superadmin') {
      logger.warn('Unauthorized org registration attempt', {
        requestId,
        role: requesterRole
      });
      res.status(403).json({ error: 'Only SuperAdmin can register organizations' });
      return;
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
      const err = error as DuckTypedError;
      const message = err.message || '';
      if (err.code === 'CONFLICT' || message.includes('exists') || message.includes('registered')) {
        logger.warn('Registration failed: Duplicate entity', { requestId, error: message });
        res.status(400).json({ error: message });
        return;
      }
      logger.error('Registration server error', { requestId, error: message, stack: err.stack });
      res.status(500).json({ error: 'Server error during registration' });
    }
  };

  /**
   * Reset organization API secret
   * POST /auth/reset-secret
   */
  resetOrganizationSecret = async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.headers['x-org-id'] as string | undefined;
      const role = req.headers['x-role'];
      const userId = req.headers['x-user-id'] as string | undefined;
      const { password } = req.body || {};

      if (!orgId || !userId) {
        logger.warn('Unauthorized reset secret attempt', { ip: req.ip });
        res.status(401).json({ error: 'Unauthorized: Missing context' });
        return;
      }

      if (role !== 'admin') {
        logger.warn('Forbidden reset secret attempt', { userId, orgId, role, ip: req.ip });
        res.status(403).json({ error: 'Forbidden: Admins only' });
        return;
      }

      if (!password) {
        logger.warn('Reset secret missing password', { userId, orgId });
        res.status(400).json({ error: 'Password is required' });
        return;
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
      const err = error as DuckTypedError;
      if (err.code === 'UNAUTHORIZED') {
        res.status(403).json({ error: 'Incorrect password' });
        return;
      }
      if (err.code === 'NOT_FOUND') {
        res.status(404).json({ error: err.message });
        return;
      }
      logger.error('Reset Secret Server Error', {
        orgId: req.headers['x-org-id'],
        error: err.message
      });
      res.status(500).json({ error: 'Server error' });
    }
  };

  /**
   * Get organization public API key
   * GET /auth/organization/keys
   */
  getOrganizationKeys = async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.headers['x-org-id'] as string | undefined;
      const userId = req.headers['x-user-id'];

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized: Missing context' });
        return;
      }

      const result = await this.organizationService.getOrganizationKeys(orgId);

      res.json({ apiKey: result.apiKey });
    } catch (error) {
      const err = error as DuckTypedError;
      if (err.code === 'NOT_FOUND') {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }
      logger.error('Get Organization Keys Error', { error: err.message });
      res.status(500).json({ error: 'Server error' });
    }
  };
}

export default OrganizationController;
