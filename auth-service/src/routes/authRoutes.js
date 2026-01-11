import express from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController.js';

const router = express.Router();

// Rate Limiter for Registration and Login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
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

// API Key Validation (Internal)
router.post('/internal/validate-api-key', authController.validateApiKey);

// Api Secret reset
router.post('/reset-secret', authController.resetOrganizationSecret);

// Password Reset Flows
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

export default router;