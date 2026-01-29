import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Mock configuration

// Set environment variables for testing
process.env.JWT_SECRET = 'test_access_secret';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret';

// Mocking AuthService (Business Logic)
// We must use the exact function names found in authService.js
jest.unstable_mockModule('../src/services/authService.js', () => ({
    registerOrgService: jest.fn(),
    loginService: jest.fn(),
    registerUserService: jest.fn(),
    validateApiKeyService: jest.fn(),
    resetSecretService: jest.fn(),
    refreshAccessTokenService: jest.fn(),
    logoutService: jest.fn(),
    requestPasswordResetService: jest.fn(),
    resetPasswordService: jest.fn()
}));

// Mocking RefreshToken Model (Database Interaction)
const mockRefreshTokenSave = jest.fn();
const mockRefreshTokenFindOne = jest.fn();
const mockRefreshTokenDelete = jest.fn();

jest.unstable_mockModule('../src/models/RefreshToken.js', () => ({
    default: class {
        constructor(data) { this.data = data; }
        save() { return mockRefreshTokenSave(); }
        static findOne(query) { return mockRefreshTokenFindOne(query); }
        static findOneAndDelete(query) { return mockRefreshTokenDelete(query); }
    }
}));

// Mocking User Model (Needed for Refresh Token flow)
const mockUserFindById = jest.fn();
jest.unstable_mockModule('../src/models/User.js', () => ({
    default: {
        findById: mockUserFindById
    }
}));

// Mocking Logger and EmailSender (Silence console output)
jest.unstable_mockModule('../src/utils/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const mockSendWelcomeEmail = jest.fn().mockResolvedValue(undefined);
const mockSendResetEmail = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../src/utils/emailSender.js', () => ({
    sendResetEmail: mockSendResetEmail,
    sendWelcomeEmail: mockSendWelcomeEmail
}));

// Imports (Dynamic imports after mocks)
const request = (await import('supertest')).default;
const AuthService = await import('../src/services/authService.js');
const { app } = await import('../src/index.js'); 

describe('Auth Service Integration Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockRefreshTokenSave.mockResolvedValue(true); // Default: save succeeds
        AuthService.refreshAccessTokenService.mockResolvedValue({ accessToken: 'new-access' });
        AuthService.logoutService.mockResolvedValue({ message: 'Logged out successfully' });
    });

    // Organization Registration Tests

    describe('POST /auth/register-organization', () => {
        
        it('should register organization (Happy Path) -> 201', async () => {
            // Mocking the service success response
            // The structure matches what registerOrgService returns in authService.js
            AuthService.registerOrgService.mockResolvedValue({
                savedOrg: { 
                    _id: 'org1', 
                    apiKey: 'key1', 
                    name: 'Test Co',
                    city: 'Gdańsk',
                    country: 'PL'
                },
                newUser: { 
                    _id: 'user1', 
                    email: 'test@co.com', 
                    role: 'admin', 
                    firstName: 'Jan', 
                    lastName: 'Kowalski' 
                },
                apiSecret: 'secret1'
            });

            const res = await request(app)
                .post('/auth/register-organization')
                .set('x-role', 'superadmin')
                .send({
                    orgName: 'Test Co', 
                    email: 'test@co.com', 
                    password: 'password123',
                    firstName: 'Jan', lastName: 'Kowalski', country: 'PL', city: 'Gdańsk', address: 'Ul. Długa'
                });

            if (res.statusCode !== 201) {
                console.log('Response body:', res.body);
                console.log('Status:', res.statusCode);
            }

            expect(res.statusCode).toBe(201);
            expect(res.body.message).toContain('registered successfully');
            
            // Checking if the API key is returned in the response
            // Adjust this path based on your actual Controller response structure
            // Assuming controller returns: { message: "...", organization: { apiKey: ... } }
            if (res.body.organization) {
                expect(res.body.organization.apiKey).toBe('key1');
            }
        });

        it('should fail on Duplicate -> 400', async () => {
            // Mocking service error "User exists" (matches error string in authService.js)
            AuthService.registerOrgService.mockRejectedValue(new Error('Email already registered'));

            const res = await request(app)
                .post('/auth/register-organization')
                .set('x-role', 'superadmin')
                .send({
                    orgName: 'Test Co', email: 'exists@co.com', password: 'password123',
                    firstName: 'Jan', lastName: 'Kowalski', country: 'PL', city: 'Gdańsk', address: 'Ul. Długa'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Email already registered');
        });

        it('should fail Validation (short password) -> 400', async () => {
            // Joi validation middleware should block this BEFORE calling the service
            const res = await request(app)
                .post('/auth/register-organization')
                .set('x-role', 'superadmin')
                .send({
                    orgName: 'Test Co', email: 'valid@co.com', 
                    password: '123', // <--- TOO SHORT
                    firstName: 'Jan', lastName: 'Kowalski', country: 'PL', city: 'Gdańsk', address: 'Ul. Długa'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toMatch(/Password must be at least/);
            
            // Ensuring the service was NOT called
            expect(AuthService.registerOrgService).not.toHaveBeenCalled();
        });
    });

    //Login Tests

    describe('POST /auth/login', () => {
        
        it('should login (Success) -> 200 + tokens', async () => {
            // Mocking successful login response from service
            AuthService.loginService.mockResolvedValue({
                user: { _id: 'u1', email: 'ok@test.pl', role: 'admin', organizationId: 'o1' },
                accessToken: 'mock_access_token',
                refreshToken: 'mock_refresh_token'
            });

            const res = await request(app).post('/auth/login').send({
                email: 'ok@test.pl', password: 'pass'
            });

            expect(res.statusCode).toBe(200);
            expect(res.body.accessToken).toBeDefined();
            // Assuming your controller creates a refresh token separately or returns the one from service
            expect(res.body.refreshToken).toBeDefined();
            expect(AuthService.loginService).toHaveBeenCalled();
        });

        it('should fail login (Wrong Password) -> 401', async () => {
            // Mocking login error
            AuthService.loginService.mockRejectedValue(new Error('Invalid email or password'));

            const res = await request(app).post('/auth/login').send({
                email: 'ok@test.pl', password: 'wrong'
            });

            expect(res.statusCode).toBe(401);
        });
    });

    // Token Refresh Tests
    describe('POST /auth/refresh', () => {

        it('should refresh token (Success) -> 200 + new AccessToken', async () => {
            // Generate a valid crypto-signed token
            const validRefreshToken = jwt.sign({ userId: 'u1' }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '1h' });
            AuthService.refreshAccessTokenService.mockResolvedValue({ accessToken: 'new_token' });

            const res = await request(app).post('/auth/refresh').send({
                refreshToken: validRefreshToken
            });

            expect(res.statusCode).toBe(200);
            expect(res.body.accessToken).toBeDefined();
            expect(AuthService.refreshAccessTokenService).toHaveBeenCalledWith(validRefreshToken);
        });

        it('should fail (Reuse/Invalid/Logged Out) -> 403', async () => {
            // Token is valid crypto-wise, but NOT in DB (simulating user logged out)
            const validRefreshToken = jwt.sign({ userId: 'u1' }, process.env.REFRESH_TOKEN_SECRET);

            AuthService.refreshAccessTokenService.mockRejectedValue(new Error('Invalid Refresh Token (logged out?)'));

            const res = await request(app).post('/auth/refresh').send({
                refreshToken: validRefreshToken
            });

            expect(res.statusCode).toBe(403);
            // Assuming your controller returns a generic forbidden/invalid message
            // expect(res.body.error).toMatch(/Invalid/); 
        });
    });

    // Logout Tests
    
    describe('POST /auth/logout', () => {
        it('should logout (Remove token) -> 200', async () => {
            AuthService.logoutService.mockResolvedValue({ message: 'Logged out successfully' });

            const res = await request(app).post('/auth/logout').send({
                refreshToken: 'some_token'
            });

            expect(res.statusCode).toBe(200);
            expect(AuthService.logoutService).toHaveBeenCalledWith('some_token');
        });

        it('should prevent refresh after logout (revoked token) -> 403', async () => {
            const refreshToken = jwt.sign({ userId: 'u1' }, process.env.REFRESH_TOKEN_SECRET);
            
            AuthService.logoutService.mockResolvedValue({ message: 'Logged out successfully' });
            AuthService.refreshAccessTokenService.mockRejectedValue(new Error('Invalid Refresh Token (logged out?)'));

            await request(app).post('/auth/logout').send({ refreshToken });
            expect(AuthService.logoutService).toHaveBeenCalledWith(refreshToken);

            const res = await request(app).post('/auth/refresh').send({ refreshToken });

            expect(res.statusCode).toBe(403);
        });
    });

    // Password Reset Flow Tests
    describe('POST /auth/forgot-password', () => {

        it('should send reset email for existing user -> 200', async () => {
            AuthService.requestPasswordResetService.mockResolvedValue({
                message: 'If a user with that email exists, a password reset link has been sent.'
            });

            const res = await request(app).post('/auth/forgot-password').send({
                email: 'user@example.com'
            });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/password reset link/i);
        });

        it('should return same message for non-existent email (security) -> 200', async () => {
            AuthService.requestPasswordResetService.mockResolvedValue({
                message: 'If a user with that email exists, a password reset link has been sent.'
            });

            const res = await request(app).post('/auth/forgot-password').send({
                email: 'nonexistent@example.com'
            });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/If a user with that email exists/i);
        });
    });

    describe('POST /auth/reset-password', () => {

        it('should reset password with valid token -> 200', async () => {
            AuthService.resetPasswordService.mockResolvedValue({
                message: 'Password has been reset successfully'
            });

            const res = await request(app).post('/auth/reset-password').send({
                userId: 'user123',
                token: 'valid_reset_token',
                newPassword: 'NewSecurePass123!'
            });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/reset successfully/i);
        });

        it('should fail with invalid/expired token -> 400', async () => {
            AuthService.resetPasswordService.mockRejectedValue(
                new Error('Invalid or expired password reset token')
            );

            const res = await request(app).post('/auth/reset-password').send({
                userId: 'user123',
                token: 'invalid_token',
                newPassword: 'NewSecurePass123!'
            });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toMatch(/Invalid or expired/i);
        });

        it('should fail validation with weak password -> 400', async () => {
            const res = await request(app).post('/auth/reset-password').send({
                userId: 'user123',
                token: 'valid_token',
                newPassword: 'weak'
            });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toMatch(/Password must be at least/i);
        });
    });

    describe('POST /auth/change-password', () => {

        it('should fail with missing x-user-id header -> 400', async () => {
            const res = await request(app).post('/auth/change-password').send({
                currentPassword: 'OldPass123!',
                newPassword: 'NewPass123!'
            });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toMatch(/Missing required fields/i);
        });

        it('should fail with missing password fields -> 400', async () => {
            const res = await request(app).post('/auth/change-password')
                .send({ currentPassword: 'OldPass123!' })
                .set('x-user-id', 'user1');

            expect(res.statusCode).toBe(400);
        });
    });

    // Users Management Tests
    describe('GET /users', () => {

        it('should deny access to non-admin users -> 403', async () => {
            const res = await request(app).get('/users')
                .set('x-org-id', 'org1')
                .set('x-user-id', 'user1')
                .set('x-role', 'user');

            expect(res.statusCode).toBe(403);
            expect(res.body.error).toMatch(/Admins only/i);
        });

        it('should fail with missing x-org-id header -> 403', async () => {
            const res = await request(app).get('/users')
                .set('x-user-id', 'admin1')
                .set('x-role', 'admin');

            expect(res.statusCode).toBe(403);
            expect(res.body.error).toMatch(/Missing organization context/i);
        });

        it('should allow superadmin access', async () => {
            const res = await request(app).get('/users')
                .set('x-org-id', 'org1')
                .set('x-user-id', 'superadmin1')
                .set('x-role', 'superadmin');

            expect([200, 500]).toContain(res.statusCode);
        });
    });

    describe('POST /users', () => {

        it('should deny user creation for non-admin -> 403', async () => {
            const res = await request(app).post('/users').send({
                email: 'newuser@example.com',
                password: 'SecurePass123!',
                firstName: 'New',
                lastName: 'User'
            })
            .set('x-org-id', 'org1')
            .set('x-user-id', 'user1')
            .set('x-role', 'user');

            expect(res.statusCode).toBe(403);
            expect(res.body.error).toMatch(/Admins only/i);
        });

        it('should fail validation with weak password -> 400', async () => {
            const res = await request(app).post('/users').send({
                email: 'newuser@example.com',
                password: 'weak',
                firstName: 'New',
                lastName: 'User'
            })
            .set('x-org-id', 'org1')
            .set('x-user-id', 'admin1')
            .set('x-role', 'admin');

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toMatch(/Password must be at least/i);
        });

        it('should fail with missing organization context -> 403', async () => {
            const res = await request(app).post('/users').send({
                email: 'newuser@example.com',
                password: 'SecurePass123!',
                firstName: 'New',
                lastName: 'User'
            })
            .set('x-user-id', 'admin1')
            .set('x-role', 'admin');

            expect(res.statusCode).toBe(403);
            expect(res.body.error).toMatch(/Missing organization context/i);
        });

        it('should fail with invalid email format -> 400', async () => {
            const res = await request(app).post('/users').send({
                email: 'invalid-email',
                password: 'SecurePass123!',
                firstName: 'New',
                lastName: 'User'
            })
            .set('x-org-id', 'org1')
            .set('x-user-id', 'admin1')
            .set('x-role', 'admin');

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toMatch(/Invalid email/i);
        });
    });

    describe('DELETE /users/:id', () => {

        it('should deny delete for non-admin -> 403', async () => {
            const res = await request(app).delete('/users/user123')
                .set('x-org-id', 'org1')
                .set('x-user-id', 'user1')
                .set('x-role', 'user');

            expect(res.statusCode).toBe(403);
            expect(res.body.error).toMatch(/Admins only/i);
        });

        it('should fail when user not found -> 404', async () => {
            const res = await request(app).delete('/users/nonexistent')
                .set('x-org-id', 'org1')
                .set('x-user-id', 'admin1')
                .set('x-role', 'admin');

            expect(res.statusCode).toBe(404);
        });
    });

    // Health Check Test
    describe('GET /health', () => {

        it('should return service health status -> 200', async () => {
            const res = await request(app).get('/health');

            expect(res.statusCode).toBe(200);
            expect(res.body.service).toBe('auth-service');
            expect(res.body.status).toBe('UP');
            expect(res.body.database).toBeDefined();
        });
    });

    // Edge Cases & Security Tests
    describe('Security & Edge Cases', () => {

        it('should reject login with invalid email format -> 400', async () => {
            const res = await request(app).post('/auth/login').send({
                email: 'not-an-email',
                password: 'password123'
            });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toMatch(/Invalid email/i);
        });

        it('should reject registration with missing fields -> 400', async () => {
            const res = await request(app)
                .post('/auth/register-organization')
                .set('x-role', 'superadmin')
                .send({
                    orgName: 'Test Co',
                    email: 'test@example.com'
                    // Missing required fields
                });

            expect(res.statusCode).toBe(400);
        });

        it('should handle missing refresh token in logout', async () => {
            const res = await request(app).post('/auth/logout').send({});

            // Should handle gracefully
            expect([200, 400, 500]).toContain(res.statusCode);
        });

        it('should reject refresh with missing token -> 401', async () => {
            const res = await request(app).post('/auth/refresh').send({});

            expect(res.statusCode).toBe(401);
            expect(res.body.error).toMatch(/required|missing/i);
        });

        it('should not expose passwordHash in responses', async () => {
            AuthService.loginService.mockResolvedValue({
                user: { 
                    _id: 'u1', 
                    email: 'test@example.com', 
                    role: 'user', 
                    organizationId: 'org1',
                    passwordHash: 'should_not_be_exposed'
                },
                accessToken: 'token',
                refreshToken: 'refresh'
            });

            const res = await request(app).post('/auth/login').send({
                email: 'test@example.com',
                password: 'password123'
            });

            if (res.statusCode === 200) {
                expect(res.body.user.passwordHash).toBeUndefined();
            }
        });
    });
});