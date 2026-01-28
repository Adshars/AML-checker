import express from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController.js';

const router = express.Router();

// Rate Limiter for Registration and Login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

//Routing

// Organization and Admin Registration
router.post('/register-organization', authController.registerOrganization);

// User Registration
router.post('/register-user', authController.registerUser);

// Login
router.post('/login', loginLimiter, authController.login);
router.post('/refresh', authController.refreshAccessToken);
router.post('/logout', authController.logout);

// API Key Validation (Internal)
router.post('/internal/validate-api-key', authController.validateApiKey);

// Api Secret reset
router.post('/reset-secret', authController.resetOrganizationSecret);

// Organization public API key
router.get('/organization/keys', authController.getOrganizationKeys);

// Password Reset Flows
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/change-password', authController.changePassword);

export default router;