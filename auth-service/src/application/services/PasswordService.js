import { NotFoundError, UnauthorizedError, ValidationError } from '../../shared/errors/index.js';
import logger from '../../shared/logger/index.js';

/**
 * Password Service
 * Handles password reset and change operations
 */
export class PasswordService {
  constructor(
    userRepository,
    passwordResetTokenRepository,
    hashingService,
    emailService,
    config
  ) {
    this.userRepository = userRepository;
    this.passwordResetTokenRepository = passwordResetTokenRepository;
    this.hashingService = hashingService;
    this.emailService = emailService;
    this.config = config;
  }

  /**
   * Request password reset
   * @param {string} email
   * @param {string} requestId - For logging
   * @returns {Promise<Object>}
   */
  async requestPasswordReset(email, requestId) {
    const successMessage = 'If a user with that email exists, a password reset link has been sent.';

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Return success even if user doesn't exist (security best practice)
      logger.info('Forgot password request for non-existent email', {
        requestId,
        email
      });
      return { message: successMessage };
    }

    // Delete existing tokens for this user
    await this.passwordResetTokenRepository.deleteByUserId(user.id);

    // Generate reset token
    const resetToken = this.hashingService.generateResetToken();

    // Save token to DB
    await this.passwordResetTokenRepository.create({
      userId: user.id,
      token: resetToken,
      createdAt: new Date()
    });

    // Create reset link
    const resetLink = `${this.config.frontendUrl}/reset-password?token=${resetToken}&id=${user.id}`;

    // Send email
    logger.info('Sending reset email to user', {
      requestId,
      userId: user.id
    });

    try {
      await this.emailService.sendResetEmail(user.email, resetLink);
    } catch (error) {
      logger.error('Failed to send reset email', {
        userId: user.id,
        error: error.message
      });
    }

    return { message: successMessage };
  }

  /**
   * Reset password with token
   * @param {string} userId
   * @param {string} token
   * @param {string} newPassword
   * @returns {Promise<Object>}
   */
  async resetPassword(userId, token, newPassword) {
    const pwdResetToken = await this.passwordResetTokenRepository.findByUserId(userId);

    if (!pwdResetToken) {
      throw new ValidationError('Invalid or expired password reset token');
    }

    // Verify token matches
    if (pwdResetToken.token !== token) {
      throw new ValidationError('Invalid or expired password reset token');
    }

    // Hash new password
    const passwordHash = await this.hashingService.hash(newPassword);

    // Update user's password
    await this.userRepository.update(userId, { passwordHash });

    // Delete the used token
    await this.passwordResetTokenRepository.deleteByUserId(userId);

    logger.info('Password reset completed', { userId });

    return { message: 'Password has been reset successfully' };
  }

  /**
   * Change password (requires current password)
   * @param {string} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<Object>}
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isMatch = await this.hashingService.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid current password');
    }

    // Hash new password
    const passwordHash = await this.hashingService.hash(newPassword);

    // Update user's password
    await this.userRepository.update(userId, { passwordHash });

    logger.info('Password changed', { userId });

    return { message: 'Password updated successfully' };
  }
}

export default PasswordService;
