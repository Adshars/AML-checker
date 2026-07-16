import logger from '../../shared/logger/index.js';
import { ChangePasswordRequestDto } from '../../application/dtos/requests/ChangePasswordRequestDto.js';
/**
 * Password Controller
 * Handles password reset and change operations
 */
export class PasswordController {
    passwordService;
    constructor(passwordService) {
        this.passwordService = passwordService;
    }
    /**
     * Request password reset
     * POST /auth/forgot-password
     */
    forgotPassword = async (req, res) => {
        const { email } = req.body;
        const requestId = `forgot-${Date.now()}`;
        try {
            const result = await this.passwordService.requestPasswordReset(email, requestId);
            res.status(200).json(result);
        }
        catch (error) {
            const err = error;
            logger.error('Forgot Password Error', { requestId, error: err.message });
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
    /**
     * Reset password with token
     * POST /auth/reset-password
     */
    resetPassword = async (req, res) => {
        const { userId, token, newPassword } = req.body;
        const requestId = `reset-${Date.now()}`;
        try {
            const result = await this.passwordService.resetPassword(userId, token, newPassword);
            logger.info('Password reset successful', { requestId, userId });
            res.json(result);
        }
        catch (error) {
            const err = error;
            const message = err.message || '';
            if (err.code === 'VALIDATION_ERROR' || message.includes('Invalid or expired')) {
                res.status(400).json({ error: message });
                return;
            }
            logger.error('Reset Password Error', { requestId, error: message });
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
    /**
     * Change password (authenticated)
     * POST /auth/change-password
     */
    changePassword = async (req, res) => {
        try {
            const userId = req.headers['x-user-id'];
            const { currentPassword, newPassword } = req.body;
            if (!userId || !currentPassword || !newPassword) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }
            const changeDto = ChangePasswordRequestDto.fromRequest(req.body, userId);
            const result = await this.passwordService.changePassword(changeDto.userId, changeDto.currentPassword, changeDto.newPassword);
            res.status(200).json(result);
        }
        catch (error) {
            const err = error;
            const message = err.message || '';
            if (err.code === 'UNAUTHORIZED' || message === 'Invalid current password') {
                res.status(400).json({ error: message });
                return;
            }
            if (err.code === 'NOT_FOUND' || message === 'User not found') {
                res.status(404).json({ error: message });
                return;
            }
            logger.error('Change password error', {
                userId: req.headers['x-user-id'],
                error: message
            });
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}
export default PasswordController;
