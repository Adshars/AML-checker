import { jest } from '@jest/globals';

// AuditLog model mock (for repository)
const mockAuditLogModel = {
    create: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn()
};

jest.unstable_mockModule('../src/infrastructure/database/sequelize/models/AuditLogModel.js', () => ({
    createAuditLogModel: () => mockAuditLogModel
}));

// Mock SequelizeConnection
jest.unstable_mockModule('../src/infrastructure/database/sequelize/connection.js', () => ({
    SequelizeConnection: class {
        constructor() {}
        async connect() {}
        async disconnect() {}
        getSequelize() {
            return {
                authenticate: jest.fn(),
                sync: jest.fn()
            };
        }
        async isHealthy() { return true; }
    }
}));

// Logger mock
jest.unstable_mockModule('../src/shared/logger/index.js', () => ({
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

// OpAdapterClient mock
jest.unstable_mockModule('../src/infrastructure/clients/OpAdapterClient.js', () => ({
    OpAdapterClient: class {
        constructor() {}
        async checkSanctions() { return { data: { hits_count: 0, data: [] }, duration: 10 }; }
    }
}));

// Config mock
jest.unstable_mockModule('../src/shared/config/index.js', () => ({
    config: {
        database: {},
        opAdapter: { baseUrl: 'http://test', timeout: 5000 },
        pagination: { defaultLimit: 20, maxLimit: 100 },
        port: 3000
    }
}));

// Imports
const request = (await import('supertest')).default;
const { Application } = await import('../src/app.js');

// Create test app
let app;
beforeAll(async () => {
    const application = new Application();
    await application.initialize();
    app = application.getApp();
});

describe('GET /history Integration Test', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 403 if x-org-id is missing (Security)', async () => {
        const res = await request(app).get('/history');
        expect(res.statusCode).toBe(403);
    });

    it('should return paginated results (Pagination)', async () => {

        // SCENARIO: The database has 100 records, we want the 1st page with 5 items
        const mockDbResponse = {
            count: 100, // Total number of records in the database
            rows: Array(5).fill({ id: 1, searchQuery: 'Test' }) // Returned 5 records
        };

        // Configure the mock
        mockAuditLogModel.findAndCountAll.mockResolvedValue(mockDbResponse);

        const res = await request(app)
            .get('/history?page=1&limit=5')
            .set('x-org-id', 'org-123')
            .set('x-user-id', 'user-456')
            .set('x-role', 'user');

        // Assertions
        expect(res.statusCode).toBe(200);
        expect(res.body.data).toHaveLength(5);

        // Check if meta data is correct
        expect(res.body.meta).toEqual({
            totalItems: 100,
            totalPages: 20, // 100 / 5 = 20
            currentPage: 1,
            itemsPerPage: 5
        });
    });

    it('should enforce data isolation for regular users', async () => {

        // SCENARIO: A user from 'ORG-A' tries to fetch history.
        // We test if the database query includes a mandatory filter on the organization.

        mockAuditLogModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await request(app)
            .get('/history')
            .set('x-org-id', 'ORG-A') // <--- User is from ORG-A
            .set('x-user-id', 'user-1')
            .set('x-role', 'user');

        // CHECKING SECURITY:
        // Was the database function called with a filter organizationId: 'ORG-A'?
        expect(mockAuditLogModel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                organizationId: 'ORG-A'
            })
        }));
    });

    it('should allow filtering by search query', async () => {
        mockAuditLogModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await request(app)
            .get('/history?search=Putin')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        // Check if search filter was added
        // Note: Sequelize uses Symbols for operators (Op.iLike),
        // so we only check if the where structure contains searchQuery.
        const callArgs = mockAuditLogModel.findAndCountAll.mock.calls[0][0];
        expect(callArgs.where).toHaveProperty('searchQuery');
    });

    it('should allow superadmin to access without x-org-id', async () => {
        mockAuditLogModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        const res = await request(app)
            .get('/history')
            .set('x-role', 'superadmin');

        expect(res.statusCode).toBe(200);
        // Should not filter by organizationId for superadmin
        expect(mockAuditLogModel.findAndCountAll).toHaveBeenCalled();
    });

    it('should filter by organization for superadmin when orgId provided', async () => {
        mockAuditLogModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await request(app)
            .get('/history?orgId=specific-org')
            .set('x-role', 'superadmin');

        expect(mockAuditLogModel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                organizationId: 'specific-org'
            })
        }));
    });

    it('should filter by hasHit parameter', async () => {
        mockAuditLogModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await request(app)
            .get('/history?hasHit=true')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        const callArgs = mockAuditLogModel.findAndCountAll.mock.calls[0][0];
        expect(callArgs.where.hasHit).toBe(true);
    });

    it('should filter by hasHit=false parameter', async () => {
        mockAuditLogModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await request(app)
            .get('/history?hasHit=false')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        const callArgs = mockAuditLogModel.findAndCountAll.mock.calls[0][0];
        expect(callArgs.where.hasHit).toBe(false);
    });

    it('should filter by userId parameter', async () => {
        mockAuditLogModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await request(app)
            .get('/history?userId=user-123')
            .set('x-org-id', 'org-1')
            .set('x-role', 'admin');

        expect(mockAuditLogModel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                userId: 'user-123'
            })
        }));
    });

    it('should filter by date range (startDate and endDate)', async () => {
        mockAuditLogModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await request(app)
            .get('/history?startDate=2024-01-01&endDate=2024-12-31')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        const callArgs = mockAuditLogModel.findAndCountAll.mock.calls[0][0];
        expect(callArgs.where.createdAt).toBeDefined();
    });

    it('should use default pagination values when not provided', async () => {
        mockAuditLogModel.findAndCountAll.mockResolvedValue({ count: 10, rows: Array(10).fill({}) });

        const res = await request(app)
            .get('/history')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        expect(res.statusCode).toBe(200);
        expect(res.body.meta).toEqual({
            totalItems: 10,
            totalPages: 1,
            currentPage: 1,
            itemsPerPage: 20
        });

        // Check default values were used
        expect(mockAuditLogModel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
            limit: 20,
            offset: 0
        }));
    });

    it('should handle page beyond available data', async () => {
        mockAuditLogModel.findAndCountAll.mockResolvedValue({ count: 10, rows: [] });

        const res = await request(app)
            .get('/history?page=100&limit=10')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toHaveLength(0);
        expect(res.body.meta.currentPage).toBe(100);
        expect(res.body.meta.totalPages).toBe(1);
    });

    it('should return 500 on database error', async () => {
        mockAuditLogModel.findAndCountAll.mockRejectedValue(new Error('Database connection lost'));

        const res = await request(app)
            .get('/history')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe('Internal Server Error');
        expect(res.body.requestId).toBeDefined();
    });
});
