import logger from '../../shared/logger/index.js';
import config from '../../shared/config/index.js';
import { LoginRequestDto } from '../../application/dtos/requests/LoginRequestDto.js';

const REFRESH_COOKIE_NAME = 'refreshToken';

/**
 * Parse duration string (e.g. '7d', '24h', '30m') to milliseconds
 */
function parseExpiryToMs(expiresIn) {
  const match = String(expiresIn).match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
  const value = parseInt(match[1], 10);
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * multipliers[match[2]];
}

function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth',
    maxAge: parseExpiryToMs(config.refreshTokenExpiresIn),
  };
}

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

      // Set refresh token as HttpOnly cookie
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

      res.json({
        message: 'Login successful',
        accessToken: result.accessToken,
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
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh Token required' });
    }

    try {
      const result = await this.authenticationService.refreshAccessToken(refreshToken);

      // Set rotated refresh token as HttpOnly cookie
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

      res.json({ accessToken: result.accessToken });
    } catch (error) {
      // Clear invalid cookie
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });

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
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    try {
      if (refreshToken) {
        await this.authenticationService.logout(refreshToken);
      }

      // Always clear the cookie
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      // Clear cookie even on error
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' });
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
