import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Organization from '../models/Organization.js';

// Helper function to generate random API keys
const generateKey = (size = 32) => crypto.randomBytes(size).toString('hex');

// Organisation and Admin Registration
export const registerOrganization = async (req, res) => {
  try {
    const { 
      orgName, country, city, address, 
      email, password, firstName, lastName 
    } = req.body;

    if (!orgName || !country || !email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Duplicate checks
    const existingOrg = await Organization.findOne({ name: orgName });
    if (existingOrg) return res.status(400).json({ error: 'Organization name already exists' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    // Generating API keys
    const apiKey = `pk_live_${generateKey(16)}`;
    const apiSecret = `sk_live_${generateKey(32)}`;
    
    // Hashing secret
    const salt = await bcrypt.genSalt(10);
    const apiSecretHash = await bcrypt.hash(apiSecret, salt);

    // Create Organization
    const newOrg = new Organization({
      name: orgName, country, city, address, apiKey, apiSecretHash
    });
    const savedOrg = await newOrg.save();

    // Create Admin User
    const passwordHash = await bcrypt.hash(password, salt);
    const newUser = new User({
      email, passwordHash, firstName, lastName,
      organizationId: savedOrg._id,
      role: 'admin'
    });
    await newUser.save();

    res.status(201).json({
      message: 'Organization registered successfully',
      organization: {
        id: savedOrg._id,
        name: savedOrg.name,
        location: `${savedOrg.city}, ${savedOrg.country}`,
        apiKey: apiKey,
        apiSecret: apiSecret 
      },
      user: {
        id: newUser._id,
        fullName: `${newUser.firstName} ${newUser.lastName}`,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

// User Registration
export const registerUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, organizationId } = req.body;

    if (!email || !password || !firstName || !lastName || !organizationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const orgExists = await Organization.findById(organizationId);
    if (!orgExists) return res.status(404).json({ error: 'Organization does not exist' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({
      email, passwordHash, firstName, lastName, organizationId,
      role: 'user'
    });
    await newUser.save();

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser._id,
        fullName: `${newUser.firstName} ${newUser.lastName}`,
        email: newUser.email,
        role: newUser.role,
        organizationId: newUser.organizationId
      }
    });
  } catch (error) {
    console.error('User Registration Error:', error);
    res.status(500).json({ error: 'Server error during user registration' });
  }
};

// Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

    const payload = {
      userId: user._id,
      organizationId: user.organizationId,
      role: user.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    res.json({
      message: 'Login successful',
      token: token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: user.organizationId
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// API Key Validation
export const validateApiKey = async (req, res) => {
  try {
    const { apiKey, apiSecret } = req.body;

    if (!apiKey || !apiSecret) return res.status(400).json({ error: 'Missing API key or secret' });

    const organization = await Organization.findOne({ apiKey });
    if (!organization) return res.status(401).json({ error: 'Invalid API key or secret' });

    const isMatch = await bcrypt.compare(apiSecret, organization.apiSecretHash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid API key or secret' });

    res.json({
      valid: true,
      organizationId: organization._id,
      organizationName: organization.name
    });
  } catch (error) {
    console.error('API Key Validation Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};