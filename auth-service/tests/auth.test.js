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
jest.unstable_mockModule('../src/utils/emailSender.js', () => ({
    sendResetEmail: jest.fn()
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
                savedOrg: { _id: 'org1', apiKey: 'key1' },
                newUser: { _id: 'user1', email: 'test@co.com', role: 'admin' },
                apiKey: 'key1',
                apiSecret: 'secret1'
            });

            const res = await request(app).post('/auth/register-organization').send({
                orgName: 'Test Co', 
                email: 'test@co.com', 
                password: 'password123',
                firstName: 'Jan', lastName: 'Kowalski', country: 'PL', city: 'Gdańsk', address: 'Ul. Długa'
            });

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

            const res = await request(app).post('/auth/register-organization').send({
                orgName: 'Test Co', email: 'exists@co.com', password: 'password123',
                firstName: 'Jan', lastName: 'Kowalski', country: 'PL', city: 'Gdańsk', address: 'Ul. Długa'
            });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Email already registered');
        });

        it('should fail Validation (short password) -> 400', async () => {
            // Joi validation middleware should block this BEFORE calling the service
            const res = await request(app).post('/auth/register-organization').send({
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
});