import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Mock configuration
process.env.JWT_SECRET = 'test_access_secret';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret';
process.env.NODE_ENV = 'test';

// Mock logger first
const mockLoggerInfo = jest.fn();
jest.unstable_mockModule('../src/shared/logger/index.js', () => ({
    default: { info: mockLoggerInfo, warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

// Mock mongoose models via schemas
const mockUserFindOne = jest.fn();
const mockUserFindById = jest.fn();
const mockUserCreate = jest.fn();
const mockUserAggregate = jest.fn();

const userModelMock = {
    findOne: mockUserFindOne,
    findById: mockUserFindById,
    create: mockUserCreate,
    aggregate: mockUserAggregate
};

jest.unstable_mockModule('../src/infrastructure/database/mongoose/schemas/UserSchema.js', () => ({
    UserModel: userModelMock,
    default: userModelMock
}));

const mockOrgFind = jest.fn();
const mockOrgFindOne = jest.fn();
const mockOrgFindById = jest.fn();
const mockOrgCreate = jest.fn();
const mockOrgFindByIdAndUpdate = jest.fn();
const mockOrgCountDocuments = jest.fn();

const orgModelMock = {
    find: mockOrgFind,
    findOne: mockOrgFindOne,
    findById: mockOrgFindById,
    create: mockOrgCreate,
    findByIdAndUpdate: mockOrgFindByIdAndUpdate,
    countDocuments: mockOrgCountDocuments
};

jest.unstable_mockModule('../src/infrastructure/database/mongoose/schemas/OrganizationSchema.js', () => ({
    OrganizationModel: orgModelMock,
    default: orgModelMock
}));

const mockRefreshTokenFindOne = jest.fn();
const mockRefreshTokenCreate = jest.fn();
const mockRefreshTokenFindOneAndDelete = jest.fn();

const refreshTokenModelMock = {
    findOne: mockRefreshTokenFindOne,
    create: mockRefreshTokenCreate,
    findOneAndDelete: mockRefreshTokenFindOneAndDelete,
    deleteMany: jest.fn(),
    find: jest.fn()
};

jest.unstable_mockModule('../src/infrastructure/database/mongoose/schemas/RefreshTokenSchema.js', () => ({
    RefreshTokenModel: refreshTokenModelMock,
    default: refreshTokenModelMock
}));

const pwdResetTokenModelMock = { findOne: jest.fn(), create: jest.fn(), findOneAndDelete: jest.fn() };

jest.unstable_mockModule('../src/infrastructure/database/mongoose/schemas/PasswordResetTokenSchema.js', () => ({
    PasswordResetTokenModel: pwdResetTokenModelMock,
    default: pwdResetTokenModelMock
}));

// Mock nodemailer
jest.unstable_mockModule('nodemailer', () => ({
    default: {
        createTransport: () => ({
            sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
            verify: jest.fn().mockResolvedValue(true)
        }),
        getTestMessageUrl: () => 'http://test-url'
    }
}));

// Imports (Dynamic imports after mocks)
const request = (await import('supertest')).default;
const bcrypt = (await import('bcryptjs')).default;
const { app } = await import('../src/index.js');
const {
    normalizeOrganizationServices,
    hasAnyService,
    DEFAULT_ORGANIZATION_SERVICES
} = await import('../src/domain/entities/OrganizationServices.js');
const { OrganizationMapper } = await import('../src/infrastructure/mappers/OrganizationMapper.js');

// Fixtures
const ORG_ID = '64b000000000000000000001';
const ORG2_ID = '64b000000000000000000002';

const orgDoc = (overrides: Record<string, unknown> = {}) => ({
    _id: ORG_ID,
    name: 'Zażółć Sp. z o.o.',
    country: 'PL',
    city: 'Gdańsk',
    address: 'Ul. Długa 1',
    apiKey: 'pk_live_test123',
    apiSecretHash: 'hashed_secret',
    services: { sanctions: true, identityMode: 'NONE' },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides
});

// OrganizationModel.find(...).sort(...).skip(...).limit(...) chain
const mockFindChain = (docs: unknown[]) => {
    const chain = {
        sort: jest.fn(),
        skip: jest.fn(),
        limit: jest.fn()
    };
    chain.sort.mockReturnValue(chain);
    chain.skip.mockReturnValue(chain);
    chain.limit.mockResolvedValue(docs as never);
    mockOrgFind.mockReturnValue(chain);
    return chain;
};

const castError = () => Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' });

const decodeAccessToken = (token: string) =>
    jwt.verify(token, process.env.JWT_SECRET as string) as Record<string, unknown>;

describe('Organization services', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockRefreshTokenCreate.mockResolvedValue({ _id: 'rt1', token: 'test-token', userId: 'u1' } as never);
        mockRefreshTokenFindOneAndDelete.mockResolvedValue(true as never);
        mockUserAggregate.mockResolvedValue([] as never);
    });

    describe('normalizeOrganizationServices', () => {
        it('returns defaults for missing input', () => {
            expect(normalizeOrganizationServices(undefined)).toEqual({ sanctions: true, identityMode: 'NONE' });
            expect(normalizeOrganizationServices(null)).toEqual(DEFAULT_ORGANIZATION_SERVICES);
        });

        it('fills partial input with defaults', () => {
            expect(normalizeOrganizationServices({ identityMode: 'FULL_AML' }))
                .toEqual({ sanctions: true, identityMode: 'FULL_AML' });
            expect(normalizeOrganizationServices({ sanctions: false }))
                .toEqual({ sanctions: false, identityMode: 'NONE' });
        });

        it('replaces unknown identity mode with default', () => {
            expect(normalizeOrganizationServices({ sanctions: false, identityMode: 'BOGUS' as never }))
                .toEqual({ sanctions: false, identityMode: 'NONE' });
        });

        it('hasAnyService rejects an empty package', () => {
            expect(hasAnyService({ sanctions: false, identityMode: 'NONE' })).toBe(false);
            expect(hasAnyService({ sanctions: false, identityMode: 'IDENTITY' })).toBe(true);
            expect(hasAnyService({ sanctions: true, identityMode: 'NONE' })).toBe(true);
        });

        it('maps a legacy document without services to defaults', () => {
            const legacy = orgDoc();
            delete (legacy as Record<string, unknown>).services;

            const entity = OrganizationMapper.toDomain(legacy as never);

            expect(entity?.services).toEqual({ sanctions: true, identityMode: 'NONE' });
        });
    });

    describe('GET /auth/organizations', () => {
        it('superadmin gets list with services and userCount -> 200', async () => {
            mockFindChain([
                orgDoc(),
                orgDoc({ _id: ORG2_ID, name: 'Legacy Co', services: undefined })
            ]);
            mockOrgCountDocuments.mockResolvedValue(2 as never);
            mockUserAggregate.mockResolvedValue([{ _id: { toString: () => ORG_ID }, count: 3 }] as never);

            const res = await request(app)
                .get('/auth/organizations')
                .set('x-role', 'superadmin');

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0]).toMatchObject({
                id: ORG_ID,
                name: 'Zażółć Sp. z o.o.',
                city: 'Gdańsk',
                country: 'PL',
                services: { sanctions: true, identityMode: 'NONE' },
                userCount: 3
            });
            expect(res.body.data[0].apiKey).toBeUndefined();
            expect(res.body.data[0].apiSecretHash).toBeUndefined();
            expect(res.body.data[1]).toMatchObject({
                services: { sanctions: true, identityMode: 'NONE' },
                userCount: 0
            });
            expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
        });

        it('applies pagination and sorts newest first', async () => {
            const chain = mockFindChain([]);
            mockOrgCountDocuments.mockResolvedValue(12 as never);

            const res = await request(app)
                .get('/auth/organizations?page=3&limit=5')
                .set('x-role', 'superadmin');

            expect(res.statusCode).toBe(200);
            expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
            expect(chain.skip).toHaveBeenCalledWith(10);
            expect(chain.limit).toHaveBeenCalledWith(5);
            expect(res.body.meta).toEqual({ page: 3, limit: 5, total: 12, totalPages: 3 });
        });

        it('caps limit at 100', async () => {
            const chain = mockFindChain([]);
            mockOrgCountDocuments.mockResolvedValue(0 as never);

            await request(app)
                .get('/auth/organizations?limit=1000')
                .set('x-role', 'superadmin');

            expect(chain.limit).toHaveBeenCalledWith(100);
        });

        it('searches by name case-insensitively with escaped regex', async () => {
            mockFindChain([]);
            mockOrgCountDocuments.mockResolvedValue(0 as never);

            await request(app)
                .get('/auth/organizations')
                .query({ search: 'a.b(c' })
                .set('x-role', 'superadmin');

            const expectedQuery = { name: { $regex: 'a\\.b\\(c', $options: 'i' } };
            expect(mockOrgFind).toHaveBeenCalledWith(expectedQuery);
            expect(mockOrgCountDocuments).toHaveBeenCalledWith(expectedQuery);
        });

        it.each([['admin'], ['user']])('role %s -> 403', async (role) => {
            const res = await request(app)
                .get('/auth/organizations')
                .set('x-role', role);

            expect(res.statusCode).toBe(403);
            expect(res.body.error).toBe('Only SuperAdmin can manage organizations');
            expect(mockOrgFind).not.toHaveBeenCalled();
        });

        it('missing role -> 403', async () => {
            const res = await request(app).get('/auth/organizations');

            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET /auth/organizations/:id', () => {
        it('superadmin gets details -> 200', async () => {
            mockOrgFindById.mockResolvedValue(orgDoc({ services: { sanctions: false, identityMode: 'FULL_AML' } }) as never);
            mockUserAggregate.mockResolvedValue([{ _id: { toString: () => ORG_ID }, count: 7 }] as never);

            const res = await request(app)
                .get(`/auth/organizations/${ORG_ID}`)
                .set('x-role', 'superadmin');

            expect(res.statusCode).toBe(200);
            expect(res.body).toMatchObject({
                id: ORG_ID,
                name: 'Zażółć Sp. z o.o.',
                address: 'Ul. Długa 1',
                services: { sanctions: false, identityMode: 'FULL_AML' },
                userCount: 7
            });
            expect(res.body.apiKey).toBeUndefined();
        });

        it('non-existing id -> 404', async () => {
            mockOrgFindById.mockResolvedValue(null as never);

            const res = await request(app)
                .get(`/auth/organizations/${ORG2_ID}`)
                .set('x-role', 'superadmin');

            expect(res.statusCode).toBe(404);
            expect(res.body.error).toBe('Organization not found');
        });

        it('malformed ObjectId -> 404 (not 500)', async () => {
            mockOrgFindById.mockRejectedValue(castError() as never);

            const res = await request(app)
                .get('/auth/organizations/not-an-id')
                .set('x-role', 'superadmin');

            expect(res.statusCode).toBe(404);
        });

        it('admin -> 403', async () => {
            const res = await request(app)
                .get(`/auth/organizations/${ORG_ID}`)
                .set('x-role', 'admin');

            expect(res.statusCode).toBe(403);
            expect(mockOrgFindById).not.toHaveBeenCalled();
        });
    });

    describe('PUT /auth/organizations/:id/services', () => {
        it('valid package -> 200 and persisted', async () => {
            mockOrgFindByIdAndUpdate.mockResolvedValue(
                orgDoc({ services: { sanctions: false, identityMode: 'IDENTITY' } }) as never
            );

            const res = await request(app)
                .put(`/auth/organizations/${ORG_ID}/services`)
                .set('x-role', 'superadmin')
                .set('x-user-id', 'sa1')
                .send({ sanctions: false, identityMode: 'IDENTITY' });

            expect(res.statusCode).toBe(200);
            expect(res.body.services).toEqual({ sanctions: false, identityMode: 'IDENTITY' });
            expect(mockOrgFindByIdAndUpdate).toHaveBeenCalledWith(
                ORG_ID,
                { $set: { services: { sanctions: false, identityMode: 'IDENTITY' } } },
                expect.objectContaining({ new: true })
            );
            expect(mockLoggerInfo).toHaveBeenCalledWith('Organization services updated', {
                organizationId: ORG_ID,
                services: { sanctions: false, identityMode: 'IDENTITY' },
                updatedBy: 'sa1'
            });
        });

        it('no service enabled -> 400', async () => {
            const res = await request(app)
                .put(`/auth/organizations/${ORG_ID}/services`)
                .set('x-role', 'superadmin')
                .send({ sanctions: false, identityMode: 'NONE' });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('At least one service must be enabled');
            expect(mockOrgFindByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('unknown identityMode -> 400', async () => {
            const res = await request(app)
                .put(`/auth/organizations/${ORG_ID}/services`)
                .set('x-role', 'superadmin')
                .send({ sanctions: true, identityMode: 'KYC_PLUS' });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('identityMode must be one of');
        });

        it.each([
            [{ identityMode: 'NONE' }, 'sanctions is required'],
            [{ sanctions: true }, 'identityMode is required']
        ])('missing field %j -> 400', async (body, message) => {
            const res = await request(app)
                .put(`/auth/organizations/${ORG_ID}/services`)
                .set('x-role', 'superadmin')
                .send(body);

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe(message);
        });

        it('non-existing organization -> 404', async () => {
            mockOrgFindByIdAndUpdate.mockResolvedValue(null as never);

            const res = await request(app)
                .put(`/auth/organizations/${ORG2_ID}/services`)
                .set('x-role', 'superadmin')
                .send({ sanctions: true, identityMode: 'NONE' });

            expect(res.statusCode).toBe(404);
        });

        it('malformed ObjectId -> 404', async () => {
            mockOrgFindByIdAndUpdate.mockRejectedValue(castError() as never);

            const res = await request(app)
                .put('/auth/organizations/xyz/services')
                .set('x-role', 'superadmin')
                .send({ sanctions: true, identityMode: 'NONE' });

            expect(res.statusCode).toBe(404);
        });

        it('admin -> 403', async () => {
            const res = await request(app)
                .put(`/auth/organizations/${ORG_ID}/services`)
                .set('x-role', 'admin')
                .send({ sanctions: true, identityMode: 'FULL_AML' });

            expect(res.statusCode).toBe(403);
            expect(mockOrgFindByIdAndUpdate).not.toHaveBeenCalled();
        });
    });

    describe('POST /auth/register-organization with services', () => {
        const registerBody = {
            orgName: 'Test Co',
            email: 'test@co.com',
            password: 'password123',
            firstName: 'Jan',
            lastName: 'Kowalski',
            country: 'PL',
            city: 'Gdańsk',
            address: 'Ul. Długa'
        };

        beforeEach(() => {
            mockOrgFindOne.mockResolvedValue(null as never);
            mockUserFindOne.mockResolvedValue(null as never);
            mockOrgCreate.mockImplementation(async (data: unknown) => ({ _id: ORG_ID, createdAt: new Date(), ...(data as object) }));
            mockUserCreate.mockImplementation(async (data: unknown) => ({ _id: 'user1', createdAt: new Date(), ...(data as object) }));
        });

        it('stores provided services', async () => {
            const res = await request(app)
                .post('/auth/register-organization')
                .set('x-role', 'superadmin')
                .send({ ...registerBody, services: { sanctions: true, identityMode: 'FULL_AML' } });

            expect(res.statusCode).toBe(201);
            expect(mockOrgCreate).toHaveBeenCalledWith(
                expect.objectContaining({ services: { sanctions: true, identityMode: 'FULL_AML' } })
            );
            expect(res.body.organization.services).toEqual({ sanctions: true, identityMode: 'FULL_AML' });
        });

        it('applies defaults when services are omitted', async () => {
            const res = await request(app)
                .post('/auth/register-organization')
                .set('x-role', 'superadmin')
                .send(registerBody);

            expect(res.statusCode).toBe(201);
            expect(mockOrgCreate).toHaveBeenCalledWith(
                expect.objectContaining({ services: { sanctions: true, identityMode: 'NONE' } })
            );
            expect(res.body.organization.services).toEqual({ sanctions: true, identityMode: 'NONE' });
        });

        it('rejects a package without any service -> 400', async () => {
            const res = await request(app)
                .post('/auth/register-organization')
                .set('x-role', 'superadmin')
                .send({ ...registerBody, services: { sanctions: false, identityMode: 'NONE' } });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('At least one service must be enabled');
            expect(mockOrgCreate).not.toHaveBeenCalled();
        });

        it('rejects unknown identityMode -> 400', async () => {
            const res = await request(app)
                .post('/auth/register-organization')
                .set('x-role', 'superadmin')
                .send({ ...registerBody, services: { sanctions: true, identityMode: 'WHATEVER' } });

            expect(res.statusCode).toBe(400);
            expect(mockOrgCreate).not.toHaveBeenCalled();
        });
    });

    describe('Tokens carry organization services', () => {
        it('login access token contains services and organizationName', async () => {
            mockUserFindOne.mockResolvedValue({
                _id: 'u1',
                email: 'ok@test.pl',
                passwordHash: await bcrypt.hash('correctpass', 10),
                role: 'admin',
                firstName: 'Test',
                lastName: 'User',
                organizationId: ORG_ID
            } as never);
            mockOrgFindById.mockResolvedValue(orgDoc({ services: { sanctions: false, identityMode: 'IDENTITY' } }) as never);

            const res = await request(app).post('/auth/login').send({
                email: 'ok@test.pl',
                password: 'correctpass'
            });

            expect(res.statusCode).toBe(200);
            const payload = decodeAccessToken(res.body.accessToken);
            expect(payload.services).toEqual({ sanctions: false, identityMode: 'IDENTITY' });
            expect(payload.organizationName).toBe('Zażółć Sp. z o.o.');
            expect(res.body.user.services).toEqual({ sanctions: false, identityMode: 'IDENTITY' });
            expect(res.body.user.organizationName).toBe('Zażółć Sp. z o.o.');
        });

        it('login without organization falls back to default services', async () => {
            mockUserFindOne.mockResolvedValue({
                _id: 'sa1',
                email: 'sa@test.pl',
                passwordHash: await bcrypt.hash('correctpass', 10),
                role: 'superadmin',
                firstName: 'Super',
                lastName: 'Admin'
            } as never);

            const res = await request(app).post('/auth/login').send({
                email: 'sa@test.pl',
                password: 'correctpass'
            });

            expect(res.statusCode).toBe(200);
            const payload = decodeAccessToken(res.body.accessToken);
            expect(payload.services).toEqual({ sanctions: true, identityMode: 'NONE' });
            expect(payload.organizationName).toBeUndefined();
            expect(mockOrgFindById).not.toHaveBeenCalled();
        });

        it('refresh issues a token with the current services from the database', async () => {
            const refreshToken = jwt.sign({ userId: 'u1' }, process.env.REFRESH_TOKEN_SECRET as string, { expiresIn: '1h' });
            mockRefreshTokenFindOne.mockResolvedValue({ _id: 'rt1', token: refreshToken, userId: 'u1' } as never);
            mockUserFindById.mockResolvedValue({
                _id: 'u1',
                email: 'test@test.pl',
                role: 'admin',
                organizationId: ORG_ID
            } as never);

            // Services changed by SuperAdmin since the last login
            mockOrgFindById.mockResolvedValue(orgDoc({ services: { sanctions: true, identityMode: 'FULL_AML' } }) as never);

            const res = await request(app)
                .post('/auth/refresh')
                .set('Cookie', `refreshToken=${refreshToken}`);

            expect(res.statusCode).toBe(200);
            const payload = decodeAccessToken(res.body.accessToken);
            expect(payload.services).toEqual({ sanctions: true, identityMode: 'FULL_AML' });
            expect(payload.organizationName).toBe('Zażółć Sp. z o.o.');
        });
    });

    describe('POST /auth/internal/validate-api-key', () => {
        it('returns organization services', async () => {
            mockOrgFindOne.mockResolvedValue(orgDoc({
                apiSecretHash: await bcrypt.hash('sk_live_secret', 10),
                services: { sanctions: false, identityMode: 'IDENTITY' }
            }) as never);

            const res = await request(app)
                .post('/auth/internal/validate-api-key')
                .send({ apiKey: 'pk_live_test123', apiSecret: 'sk_live_secret' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({
                valid: true,
                organizationId: ORG_ID,
                organizationName: 'Zażółć Sp. z o.o.',
                services: { sanctions: false, identityMode: 'IDENTITY' }
            });
        });

        it('returns default services for a legacy organization', async () => {
            mockOrgFindOne.mockResolvedValue(orgDoc({
                apiSecretHash: await bcrypt.hash('sk_live_secret', 10),
                services: undefined
            }) as never);

            const res = await request(app)
                .post('/auth/internal/validate-api-key')
                .send({ apiKey: 'pk_live_test123', apiSecret: 'sk_live_secret' });

            expect(res.statusCode).toBe(200);
            expect(res.body.services).toEqual({ sanctions: true, identityMode: 'NONE' });
        });
    });
});
