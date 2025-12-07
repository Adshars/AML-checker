import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import Organization from '../models/Organization.js';

const router = express.Router();

// Helper function to generate random API keys
const generateKey = (size = 32) => crypto.randomBytes(size).toString('hex');

// POST /register - new user and organization registration
router.post('/register', async (req, res) => {
  try {
    // 1. Extract extended data from the form
    const { 
      orgName, country, city, address, //Organisation data
      email, password, firstName, lastName // Admin data
    } = req.body;

    if (!orgName || !country || !email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Duplicate checks
    const existingOrg = await Organization.findOne({ name: orgName });
    if (existingOrg) return res.status(400).json({ error: 'Organization name already exists' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    // Generating API keys (for B2B machine access)
    const apiKey = `pk_live_${generateKey(16)}`;
    const apiSecret = `sk_live_${generateKey(32)}`;
    
    // Hashing the secret (like a password)
    const salt = await bcrypt.genSalt(10);
    const apiSecretHash = await bcrypt.hash(apiSecret, salt);

    // Creating Organization in the Database
    const newOrg = new Organization({
      name: orgName,
      country,
      city,
      address,
      apiKey,
      apiSecretHash
    });
    const savedOrg = await newOrg.save();

    // Creating User (Admin) associated with this organization
    const passwordHash = await bcrypt.hash(password, salt);
    
    const newUser = new User({
      email,
      passwordHash,
      firstName,
      lastName,
      organizationId: savedOrg._id, // Relationship binding: User -> Org
      role: 'admin'
    });
    await newUser.save();

    // Success - Return response (without password hashes!)
    res.status(201).json({
      message: 'Registration successful',
      organization: {
        id: savedOrg._id,
        name: savedOrg.name,
        location: `${savedOrg.city}, ${savedOrg.country}`,
        apiKey: apiKey,
        // IMPORTANT: Display Secret Key only ONCE after registration!
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
});

export default router;