import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Mock configuration
process.env.JWT_SECRET = 'test_access_secret';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret';
process.env.NODE_ENV = 'test';

// Mock logger first
jest.unstable_mockModule('../src/shared/logger/index.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

// Mock mongoose models via schemas
const mockUserFindOne = jest.fn();
const mockUserFindById = jest.fn();
const mockUserFind = jest.fn();
const mockUserCreate = jest.fn();
const mockUserFindByIdAndDelete = jest.fn();
const mockUserFindByIdAndUpdate = jest.fn();
const mockUserCountDocuments = jest.fn();

jest.unstable_mockModule('../src/infrastructure/database/mongoose/schemas/UserSchema.js', () => ({
    UserModel: {
        findOne: mockUserFindOne,
        findById: mockUserFindById,
        find: mockUserFind,
        create: mockUserCreate,
        findByIdAndDelete: mockUserFindByIdAndDelete,
        findByIdAndUpdate: mockUserFindByIdAndUpdate,
        countDocuments: mockUserCountDocuments
    },
    default: {
        findOne: mockUserFindOne,
        findById: mockUserFindById,
        find: mockUserFind,
        create: mockUserCreate,
        findByIdAndDelete: mockUserFindByIdAndDelete,
        findByIdAndUpdate: mockUserFindByIdAndUpdate,
        countDocuments: mockUserCountDocuments
    }
}));

const mockOrgFindOne = jest.fn();
const mockOrgFindById = jest.fn();
const mockOrgCreate = jest.fn();
const mockOrgFindByIdAndUpdate = jest.fn();
const mockOrgCountDocuments = jest.fn();

jest.unstable_mockModule('../src/infrastructure/database/mongoose/schemas/OrganizationSchema.js', () => ({
    OrganizationModel: {
        findOne: mockOrgFindOne,
        findById: mockOrgFindById,
        create: mockOrgCreate,
        findByIdAndUpdate: mockOrgFindByIdAndUpdate,
        countDocuments: mockOrgCountDocuments
    },
    default: {
        findOne: mockOrgFindOne,
        findById: mockOrgFindById,
        create: mockOrgCreate,
        findByIdAndUpdate: mockOrgFindByIdAndUpdate,
        countDocuments: mockOrgCountDocuments
    }
}));

const mockRefreshTokenFindOne = jest.fn();
const mockRefreshTokenCreate = jest.fn();
const mockRefreshTokenFindOneAndDelete = jest.fn();
const mockRefreshTokenDeleteMany = jest.fn();
const mockRefreshTokenFind = jest.fn();

jest.unstable_mockModule('../src/infrastructure/database/mongoose/schemas/RefreshTokenSchema.js', () => ({
    RefreshTokenModel: {
        findOne: mockRefreshTokenFindOne,
        create: mockRefreshTokenCreate,
        findOneAndDelete: mockRefreshTokenFindOneAndDelete,
        deleteMany: mockRefreshTokenDeleteMany,
        find: mockRefreshTokenFind
    },
    default: {
        findOne: mockRefreshTokenFindOne,
        create: mockRefreshTokenCreate,
        findOneAndDelete: mockRefreshTokenFindOneAndDelete,
        deleteMany: mockRefreshTokenDeleteMany,
        find: mockRefreshTokenFind
    }
}));

const mockPwdResetTokenFindOne = jest.fn();
const mockPwdResetTokenCreate = jest.fn();
const mockPwdResetTokenFindOneAndDelete = jest.fn();

jest.unstable_mockModule('../src/infrastructure/database/mongoose/schemas/PasswordResetTokenSchema.js', () => ({
    PasswordResetTokenModel: {
        findOne: mockPwdResetTokenFindOne,
        create: mockPwdResetTokenCreate,
        findOneAndDelete: mockPwdResetTokenFindOneAndDelete
    },
    default: {
        findOne: mockPwdResetTokenFindOne,
        create: mockPwdResetTokenCreate,
        findOneAndDelete: mockPwdResetTokenFindOneAndDelete
    }
}));

// Mock nodemailer
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
const mockVerify = jest.fn().mockResolvedValue(true);
jest.unstable_mockModule('nodemailer', () => ({
    default: {
        createTransport: () => ({
            sendMail: mockSendMail,
            verify: mockVerify
        }),
        getTestMessageUrl: () => 'http://test-url'
    }
}));

// Imports (Dynamic imports after mocks)
const request = (await import('supertest')).default;
const bcrypt = (await import('bcryptjs')).default;
const { app } = await import('../src/index.js');

// Helper to create hashed password
const hashPassword = async (password) => bcrypt.hash(password, 10);

describe('Auth Service Integration Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock behaviors
        mockRefreshTokenCreate.mockResolvedValue({ _id: 'rt1', token: 'test-token', userId: 'u1' });
        mockRefreshTokenFindOneAndDelete.mockResolvedValue(true);
    });

    // Organization Registration Tests
    describe('POST /auth/register-organization', () => {

        it('should register organization (Happy Path) -> 201', async () => {
            mockOrgFindOne.mockResolvedValue(null); // No existing org
            mockUserFindOne.mockResolvedValue(null); // No existing user
            mockUserCountDocuments.mockResolvedValue(0);
            mockOrgCountDocuments.mockResolvedValue(0);

            mockOrgCreate.mockResolvedValue({
                _id: 'org1',
                name: 'Test Co',
                city: 'Gdańsk',
                country: 'PL',
                address: 'Ul. Długa',
                apiKey: 'pk_live_test123',
                apiSecretHash: 'hashed_secret',
                createdAt: new Date()
            });

            mockUserCreate.mockResolvedValue({
                _id: 'user1',
                email: 'test@co.com',
                firstName: 'Jan',
                lastName: 'Kowalski',
                role: 'admin',
                organizationId: 'org1',
                createdAt: new Date()
            });

            const res = await request(app)
                .post('/auth/register-organization')
                .set('x-role', 'superadmin')
                .send({
                    orgName: 'Test Co',
                    email: 'test@co.com',
                    password: 'password123',
                    firstName: 'Jan',
                    lastName: 'Kowalski',
                    country: 'PL',
                    city: 'Gdańsk',
                    address: 'Ul. Długa'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.message).toContain('registered successfully');
            expect(res.body.organization).toBeDefined();
            expect(res.body.organization.apiKey).toBeDefined();
            expect(res.body.organization.apiSecret).toBeDefined();
        });

        it('should fail on Duplicate Organization -> 400', async () => {
            mockOrgFindOne.mockResolvedValue({ _id: 'existing', name: 'Test Co' }); // Org exists

            const res = await request(app)
                .post('/auth/register-organization')
                .set('x-role', 'superadmin')
                .send({
                    orgName: 'Test Co',
                    email: 'exists@co.com',
                    password: 'password123',
                    firstName: 'Jan',
                    lastName: 'Kowalski',
                    country: 'PL',
                    city: 'Gdańsk',
                    address: 'Ul. Długa'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toMatch(/already exists/i);
        });

        it('should fail Validation (short password) -> 400', async () => {
            const res = await request(app)
                .post('/auth/register-organization')
                .set('x-role', 'superadmin')
                .send({
                    orgName: 'Test Co',
                    email: 'valid@co.com',
                    password: '123', // TOO SHORT
                    firstName: 'Jan',
                    lastName: 'Kowalski',
                    country: 'PL',
                    city: 'Gdańsk',
                    address: 'Ul. Długa'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toMatch(/Password must be at least/);
            expect(mockOrgCreate).not.toHaveBeenCalled();
        });

        it('should reject non-superadmin -> 403', async () => {
            const res = await request(app)
                .post('/auth/register-organization')
                .set('x-role', 'admin')
                .send({
                    orgName: 'Test Co',
                    email: 'test@co.com',
                    password: 'password123',
                    firstName: 'Jan',
                    lastName: 'Kowalski',
                    country: 'PL',
                    city: 'Gdańsk',
                    address: 'Ul. Długa'
                });

            expect(res.statusCode).toBe(403);
        });
    });

    // Login Tests
    describe('POST /auth/login', () => {

        it('should login (Success) -> 200 + accessToken in body + refreshToken in HttpOnly cookie', async () => {
            const hashedPassword = await hashPassword('correctpass');

            mockUserFindOne.mockResolvedValue({
                _id: 'u1',
                email: 'ok@test.pl',
                passwordHash: hashedPassword,
                role: 'admin',
                firstName: 'Test',
                lastName: 'User',
                organizationId: 'o1'
            });

            const res = await request(app).post('/auth/login').send({
                email: 'ok@test.pl',
                password: 'correctpass'
            });

            expect(res.statusCode).toBe(200);
            expect(res.body.accessToken).toBeDefined();
            expect(res.body.refreshToken).toBeUndefined();
            expect(res.body.user).toBeDefined();

            // Verify refreshToken is set as HttpOnly cookie
            const cookies = res.headers['set-cookie'];
            expect(cookies).toBeDefined();
            const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
            expect(refreshCookie).toBeDefined();
            expect(refreshCookie).toContain('HttpOnly');
            expect(refreshCookie).toContain('Path=/auth');
        });

        it('should fail login (Wrong Password) -> 401', async () => {
            const hashedPassword = await hashPassword('correctpass');

            mockUserFindOne.mockResolvedValue({
                _id: 'u1',
                email: 'ok@test.pl',
                passwordHash: hashedPassword,
                role: 'admin',
                organizationId: 'o1'
            });

            const res = await request(app).post('/auth/login').send({
                email: 'ok@test.pl',
                password: 'wrongpass'
            });

            expect(res.statusCode).toBe(401);
        });

        it('should fail login (User not found) -> 401', async () => {
            mockUserFindOne.mockResolvedValue(null);

            const res = await request(app).post('/auth/login').send({
                email: 'notfound@test.pl',
                password: 'password'
            });

            expect(res.statusCode).toBe(401);
        });
    });

    // Token Refresh Tests
    describe('POST /auth/refresh', () => {

        it('should refresh token (Success) -> 200 + new AccessToken + rotated cookie', async () => {
            const validRefreshToken = jwt.sign({ userId: 'u1' }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '1h' });

            mockRefreshTokenFindOne.mockResolvedValue({
                _id: 'rt1',
                token: validRefreshToken,
                userId: 'u1'
            });

            mockUserFindById.mockResolvedValue({
                _id: 'u1',
                email: 'test@test.pl',
                role: 'admin',
                organizationId: 'o1'
            });

            const res = await request(app)
                .post('/auth/refresh')
                .set('Cookie', `refreshToken=${validRefreshToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.accessToken).toBeDefined();

            // Verify rotated refreshToken cookie is set
            const cookies = res.headers['set-cookie'];
            expect(cookies).toBeDefined();
            const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
            expect(refreshCookie).toBeDefined();
            expect(refreshCookie).toContain('HttpOnly');
        });

        it('should fail (Token not in DB / Logged Out) -> 403', async () => {
            const validRefreshToken = jwt.sign({ userId: 'u1' }, process.env.REFRESH_TOKEN_SECRET);
            mockRefreshTokenFindOne.mockResolvedValue(null); // Token not in DB

            const res = await request(app)
                .post('/auth/refresh')
                .set('Cookie', `refreshToken=${validRefreshToken}`);

            expect(res.statusCode).toBe(403);
        });

        it('should fail (Missing Token / No cookie) -> 401', async () => {
            const res = await request(app).post('/auth/refresh');

            expect(res.statusCode).toBe(401);
        });
    });

    // Logout Tests
    describe('POST /auth/logout', () => {
        it('should logout (Remove token from cookie) -> 200 + clear cookie', async () => {
            mockRefreshTokenFindOneAndDelete.mockResolvedValue(true);

            const res = await request(app)
                .post('/auth/logout')
                .set('Cookie', 'refreshToken=some_token');

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/logged out/i);

            // Verify cookie is cleared
            const cookies = res.headers['set-cookie'];
            expect(cookies).toBeDefined();
            const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
            expect(refreshCookie).toBeDefined();
        });

        it('should logout gracefully even without cookie -> 200', async () => {
            const res = await request(app).post('/auth/logout');

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/logged out/i);
        });
    });

    // Password Reset Flow Tests
    describe('POST /auth/forgot-password', () => {

        it('should send reset email for existing user -> 200', async () => {
            mockUserFindOne.mockResolvedValue({
                _id: 'u1',
                email: 'user@example.com'
            });
            mockPwdResetTokenFindOneAndDelete.mockResolvedValue(true);
            mockPwdResetTokenCreate.mockResolvedValue({
                _id: 'prt1',
                userId: 'u1',
                token: 'reset-token'
            });

            const res = await request(app).post('/auth/forgot-password').send({
                email: 'user@example.com'
            });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/password reset link/i);
        });

        it('should return same message for non-existent email (security) -> 200', async () => {
            mockUserFindOne.mockResolvedValue(null);

            const res = await request(app).post('/auth/forgot-password').send({
                email: 'nonexistent@example.com'
            });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/If a user with that email exists/i);
        });
    });

    describe('POST /auth/reset-password', () => {

        it('should reset password with valid token -> 200', async () => {
            mockPwdResetTokenFindOne.mockResolvedValue({
                _id: 'prt1',
                userId: 'user123',
                token: 'valid_reset_token'
            });
            mockUserFindByIdAndUpdate.mockResolvedValue({
                _id: 'user123',
                email: 'test@example.com'
            });
            mockPwdResetTokenFindOneAndDelete.mockResolvedValue(true);

            const res = await request(app).post('/auth/reset-password').send({
                userId: 'user123',
                token: 'valid_reset_token',
                newPassword: 'NewSecurePass123!'
            });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/reset successfully/i);
        });

        it('should fail with invalid token -> 400', async () => {
            mockPwdResetTokenFindOne.mockResolvedValue({
                _id: 'prt1',
                userId: 'user123',
                token: 'different_token' // Token doesn't match
            });

            const res = await request(app).post('/auth/reset-password').send({
                userId: 'user123',
                token: 'invalid_token',
                newPassword: 'NewSecurePass123!'
            });

            expect(res.statusCode).toBe(400);
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

        it('should allow admin access and return users', async () => {
            mockUserFind.mockReturnValue({
                map: () => []
            });

            const res = await request(app).get('/users')
                .set('x-org-id', 'org1')
                .set('x-user-id', 'admin1')
                .set('x-role', 'admin');

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toBeDefined();
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
            mockUserFindById.mockResolvedValue(null);

            const res = await request(app).delete('/users/nonexistent')
                .set('x-org-id', 'org1')
                .set('x-user-id', 'admin1')
                .set('x-role', 'admin');

            expect(res.statusCode).toBe(404);
        });

        it('should prevent self-deletion -> 400', async () => {
            const res = await request(app).delete('/users/admin1')
                .set('x-org-id', 'org1')
                .set('x-user-id', 'admin1')
                .set('x-role', 'admin');

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toMatch(/Cannot delete your own account/i);
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

    // Security & Edge Cases
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

        it('should reject refresh with missing cookie -> 401', async () => {
            const res = await request(app).post('/auth/refresh');

            expect(res.statusCode).toBe(401);
            expect(res.body.error).toMatch(/required|missing/i);
        });
    });
});
