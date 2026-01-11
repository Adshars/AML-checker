import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { generateKey } from '../utils/cryptoUtils.js';

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

    // Generate payload for JWT
    const payload = {
        userId: user._id,
        organizationId: user.organizationId,
        role: user.role
    };

    // Sign JWT
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '4h' });

    return { user, token };
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