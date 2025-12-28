import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Helper function to generate random API keys
const generateKey = (size = 32) => crypto.randomBytes(size).toString('hex');

// POST /register-organization - new organization registration and admin
router.post('/register-organization', async (req, res) => {
  try {
    // Extract extended data from the form
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
      message: 'Organization registered successfully',
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

    // User with "user" role registration
    // POST /register-user

    router.post('/register-user', async (req, res) => {
      try {
        const { email, password, firstName, lastName, organizationId } = req.body;

        //walidation
        if (!email || !password || !firstName || !lastName || !organizationId) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if organization exists
        const orgExists = await Organization.findById(organizationId);

        // If organization does not exist, return error
        if (!orgExists) return res.status(404).json({ error: 'Organization does not exist' });

        // Check for duplicate email
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'Email already registered' });

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = new User({
          email,
          passwordHash,
          firstName,
          lastName,
          organizationId,
          role: 'user' // Default role is "user"
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
      }
      catch (error) {
        console.error('User Registration Error:', error);
        res.status(500).json({ error: 'Server error during user registration' });
      }
  });

  // Login (JWT generation)
  // POST /login

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validation

      if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password' });
      }

      // Find user by email

      const user  = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Compare password

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate JWT

      const payload = {
        userId: user._id,
        organizationId: user.organizationId,
        role: user.role
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '8h' // Token valid for 8 hour
      });

      // Success - Return token

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
  });

  // Internal endpont: Vlaidate API Key and Secret
  // POST /internal/validate-api-key

  router.post('/internal/validate-api-key', async (req, res) => {
    try {
      // Gateway for B2B machine access validation
      const { apiKey, apiSecret } = req.body;

      if (!apiKey || !apiSecret) {
        return res.status(400).json({ error: 'Missing API key or secret' });
      }

      // Find organization by API key

      const organization = await Organization.findOne({ apiKey });

      if (!organization) {
        return res.status(401).json({ error: 'Invalid API key or secret' });
      }

      // Compare API secret

      const isMatch = await bcrypt.compare(apiSecret, organization.apiSecretHash);

      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid API key or secret' });
      }

      // Success - Return organization info

      res.json({
        valid: true,
        organizationId: organization._id,
        organizationName: organization.name
      });

    } catch (error) {
      console.error('API Key Validation Error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });


export default router;