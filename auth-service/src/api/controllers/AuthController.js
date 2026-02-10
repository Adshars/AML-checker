import logger from '../../shared/logger/index.js';
import { LoginRequestDto } from '../../application/dtos/requests/LoginRequestDto.js';

/**
 * Authentication Controller
 * Handles login, logout, refresh, and API key validation
 */
export class AuthController {
  constructor(authenticationService) {
    this.authenticationService = authenticationService;
  }

  /**
   * User login
   * POST /auth/login
   */
  login = async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;

    try {
      const loginDto = LoginRequestDto.fromRequest(req.body);

      logger.info('Login attempt', { email: loginDto.email, ip });

      const result = await this.authenticationService.login(loginDto);

      logger.info('Login successful', {
        userId: result.user.id,
        role: result.user.role,
        orgId: result.user.organizationId
      });

      res.json({
        message: 'Login successful',
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user
      });
    } catch (error) {
      logger.warn('Login failed: Invalid credentials', {
        email: req.body?.email,
        ip,
        error: error.message
      });
      res.status(401).json({ error: 'Invalid email or password' });
    }
  };

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  refreshAccessToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh Token required' });
    }

    try {
      const result = await this.authenticationService.refreshAccessToken(refreshToken);
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

  /**
   * Logout user
   * POST /auth/logout
   */
  logout = async (req, res) => {
    const { refreshToken } = req.body;

    try {
      const result = await this.authenticationService.logout(refreshToken);
      res.json(result);
    } catch (error) {
      logger.error('Logout Error', { error: error.message });
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  /**
   * Validate API key for B2B authentication
   * POST /auth/internal/validate-api-key
   */
  validateApiKey = async (req, res) => {
    try {
      const { apiKey, apiSecret } = req.body;

      const maskedKey = apiKey ? `${apiKey.substring(0, 8)}...` : 'missing';
      logger.debug('Validating API Key', { maskedKey });

      if (!apiKey || !apiSecret) {
        return res.status(400).json({ error: 'Missing API key or secret' });
      }

      const result = await this.authenticationService.validateApiKey(apiKey, apiSecret);

      logger.debug('API Key validation successful', { orgId: result.organizationId });

      res.json({
        valid: true,
        organizationId: result.organizationId,
        organizationName: result.name
      });
    } catch (error) {
      logger.warn('API Key validation failed', {
        error: error.message,
        apiKey: req.body?.apiKey ? `${req.body.apiKey.substring(0, 8)}...` : 'missing'
      });
      res.status(401).json({ error: 'Invalid API key or secret' });
    }
  };
}

export default AuthController;
