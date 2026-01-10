import * as AuthService from '../services/authService.js';


 // Registration organisation and admin user
export const registerOrganization = async (req, res) => {
  try {
    const { 
      orgName, country, city, address, 
      email, password, firstName, lastName 
    } = req.body;

    // Validation
    if (!orgName || !country || !email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Call business logic from Service
    const result = await AuthService.registerOrgService(req.body);

    // Success
    res.status(201).json({
      message: 'Organization registered successfully',
      organization: {
        id: result.savedOrg._id,
        name: result.savedOrg.name,
        location: `${result.savedOrg.city}, ${result.savedOrg.country}`,
        apiKey: result.savedOrg.apiKey,
        apiSecret: result.apiSecret // Only shown at creation
      },
      user: {
        id: result.newUser._id,
        fullName: `${result.newUser.firstName} ${result.newUser.lastName}`,
        email: result.newUser.email,
        role: result.newUser.role
      }
    });

  } catch (error) {
    console.error('Registration Error:', error.message);
    // Differentiating errors (Duplicate vs Server error)
    if (error.message.includes('exists') || error.message.includes('registered')) {
        return res.status(400).json({ error: error.message });
    }
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

    const newUser = await AuthService.registerUserService(req.body);

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
    console.error('User Registration Error:', error.message);
    if (error.message.includes('Organization does not exist')) return res.status(404).json({ error: error.message });
    if (error.message.includes('registered')) return res.status(400).json({ error: error.message });
    
    res.status(500).json({ error: 'Server error during user registration' });
  }
};

// User Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

    const result = await AuthService.loginService(email, password);

    res.json({
      message: 'Login successful',
      token: result.token,
      user: {
        id: result.user._id,
        email: result.user.email,
        role: result.user.role,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        organizationId: result.user.organizationId
      }
    });

  } catch (error) {
    console.error('Login Error:', error.message);
    // Security: Always return 401 on login error
    res.status(401).json({ error: 'Invalid email or password' });
  }
};

// API Key Validation
export const validateApiKey = async (req, res) => {
  try {
    const { apiKey, apiSecret } = req.body;

    console.log(`[AUTH-DEBUG] Validating Key: ${apiKey}`);

    if (!apiKey || !apiSecret) {
        return res.status(400).json({ error: 'Missing API key or secret' });
    }

    const organization = await AuthService.validateApiKeyService(apiKey, apiSecret);

    console.log('[AUTH-DEBUG] ✅ Validation successful!');
    res.json({
      valid: true,
      organizationId: organization._id,
      organizationName: organization.name
    });

  } catch (error) {
    console.error('[AUTH-DEBUG] Validation Failed:', error.message);
    res.status(401).json({ error: 'Invalid API key or secret' });
  }
};

// Reset Organization API Secret
export const resetOrganizationSecret = async (req, res) => {
  try {
    // Data injected by API Gateway
    const orgId = req.headers['x-org-id'];
    const role = req.headers['x-role'];
    const userId = req.headers['x-user-id'];

    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized: Missing context' });
    }

    if (role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admins only' });
    }

    const result = await AuthService.resetSecretService(orgId);

    console.log(`[AUTH] Secret reset for Org: ${orgId} by User: ${userId}`);

    res.json({
      message: 'API secret reset successfully',
      apiKey: result.updatedOrg.apiKey,
      newApiSecret: result.newApiSecret
    });

  } catch (error) {
    console.error('Reset Secret Error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};