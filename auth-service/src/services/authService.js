import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import RefreshToken from '../models/RefreshToken.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import { generateKey } from '../utils/cryptoUtils.js';
import { sendResetEmail } from '../utils/emailSender.js';
import logger from '../utils/logger.js';

// Registration organisation and admin user
export const registerOrgService = async (data) => {
  const { 
    orgName, country, city, address, 
    email, password, firstName, lastName 
  } = data;

    // Duplicate checks
    const existingOrg = await Organization.findOne({ name: orgName });
    if (existingOrg) 
        throw new Error('Organization name already exists');
    
    // Check if email already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new Error('Email already registered');
    }

// API key generation
const apiKey = `pk_live_${generateKey(16)}`;
const apiSecret = `sk_live_${generateKey(32)}`;

// Hashing secret
const salt = await bcrypt.genSalt(10);
const apiSecretHash = await bcrypt.hash(apiSecret, salt);

// Save Organization
const newOrg = new Organization({
  name: orgName, country, city, address, apiKey, apiSecretHash
});
const savedOrg = await newOrg.save();

// Hash admin password
const passwordHash = await bcrypt.hash(password, salt);

// Save Admin User

const newUser = new User({
  email, passwordHash, firstName, lastName,
  organizationId: savedOrg._id,
  role: 'admin'
});
await newUser.save();

// Return organization and user details

return {
    savedOrg,
    newUser,
    apiKey,
    apiSecret
    };
};

// User Registration from Admin

export const registerUserService = async (data) => {
  const { email, password, firstName, lastName, organizationId } = data;

  // Check organization existence
  const orgExists = await Organization.findById(organizationId);
  if (!orgExists) {
    throw new Error('Organization does not exist');
}

// Duplicate email check
const existUser = await User.findOne({ email });
if (existUser) {
throw new Error('Email already registered');
}

// Hash user password
const salt = await bcrypt.genSalt(10);
const passwordHash = await bcrypt.hash(password, salt);

// Save User
const newUser = new User({
  email, passwordHash, firstName, lastName, organizationId,
  role: 'user'
});
await newUser.save();

return newUser;
};

// Login Service

export const loginService = async (email, password) => {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
        throw new Error('Invalid email or password');
    }
    // Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
        throw new Error('Invalid email or password');
    }

    // Generate Access Token
    const accessToken = jwt.sign(
        { 
            userId: user._id, 
            organizationId: user.organizationId, 
            role: user.role 
        }, 
        process.env.JWT_SECRET, 
        { expiresIn: '15m' }
    );

    // Generate Refresh Token
    const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
    );

    // Save Refresh Token in DB
    await new RefreshToken({
        token: refreshToken,
        userId: user._id
    }).save();

    return { user, accessToken, refreshToken };
};

// Validation Api Key Service

export const validateApiKeyService = async (apiKey, apiSecret) => {
    // Find organization by apiKey
    const organization = await Organization.findOne({ apiKey });

    if (!organization) {
        throw new Error('Invalid API Key or Secret');
    }

    // Compare apiSecret
    const isMatch = await bcrypt.compare(apiSecret, organization.apiSecretHash);
    if (!isMatch) {
        throw new Error('Invalid API Key or Secret');
    }   

    return organization;
};

// Reset API Secret Service

export const resetSecretService = async (orgId) => {
    // New API secret generation
    const newApiSecret = `sk_live_${generateKey(32)}`;

    // Hash new secret
    const salt = await bcrypt.genSalt(10);
    const newApiSecretHash = await bcrypt.hash(newApiSecret, salt);

    // Update organization with new secret hash
    
    const updatedOrg = await Organization.findByIdAndUpdate(
        orgId, 
        { apiSecretHash: newApiSecretHash }, 
        { new: true }
    );

    if (!updatedOrg) {
        throw new Error('Organization not found');
    }

    return { updatedOrg, newApiSecret };
};

// Refresh Access Token Service

export const refreshAccessTokenService = async (refreshToken) => {
    // Check if token is in DB (not revoked)
    const storedToken = await RefreshToken.findOne({ token: refreshToken });
    if (!storedToken) {
        throw new Error('Invalid Refresh Token (logged out?)');
    }

    // Cryptographic verification
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Fetch user (role might have changed)
    const user = await User.findById(decoded.userId);
    if (!user) {
        throw new Error('User not found');
    }

    // Generate NEW Access Token
    const newAccessToken = jwt.sign(
        { userId: user._id, organizationId: user.organizationId, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );

    logger.info('Access Token refreshed', { userId: user._id });
    return { accessToken: newAccessToken };
};

// Logout Service

export const logoutService = async (refreshToken) => {
    // Delete the refresh token from DB
    await RefreshToken.findOneAndDelete({ token: refreshToken });
    logger.info('User logged out (Refresh Token revoked)');
    return { message: 'Logged out successfully' };
};

// Request Password Reset Service

export const requestPasswordResetService = async (email, requestId) => {
    const user = await User.findOne({ email });
    if (!user) {
        // Return success even if user doesn't exist (security best practice)
        logger.info('Forgot password request for non-existent email', { requestId, email });
        return { message: 'If a user with that email exists, a password reset link has been sent.' };
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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${frontendUrl}/reset-password?token=${resetToken}&id=${user._id}`;

    // Send email
    logger.info('Sending reset email to user', { requestId, userId: user._id });
    await sendResetEmail(user.email, link);

    return { message: 'If a user with that email exists, a password reset link has been sent.' };
};

// Reset Password Service

export const resetPasswordService = async (userId, token, newPassword) => {
    const pwdResetToken = await PasswordResetToken.findOne({ userId });

    if (!pwdResetToken) {
        throw new Error('Invalid or expired password reset token');
    }

    // Verify token
    const isValid = pwdResetToken.token === token;
    if (!isValid) {
        throw new Error('Invalid or expired password reset token');
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

    return { message: 'Password has been reset successfully' };
};

// Change password (requires current password verification)
export const changePasswordService = async (userId, currentPassword, newPassword) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
        throw new Error('Invalid current password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hashedPassword;
    await user.save();

    return { message: 'Password updated successfully' };
};