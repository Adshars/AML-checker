import { jest } from '@jest/globals';

// Mocking

// Mockujemy AuditLog model
jest.unstable_mockModule('../src/models/AuditLog.js', () => ({
    default: {
        findAndCountAll: jest.fn()
    }
}));

// Logger mock (to avoid cluttering the console during tests)
jest.unstable_mockModule('../src/utils/logger.js', () => ({
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

// OpAdapterClient mock (index wiring creates it)
jest.unstable_mockModule('../src/clients/OpAdapterClient.js', () => ({
    default: class {
        checkSanctions() { return Promise.resolve({ data: { hits_count: 0, data: [] }, duration: 10 }); }
    }
}));

// Imports 
const request = (await import('supertest')).default;
const AuditLog = (await import('../src/models/AuditLog.js')).default;
const { app } = await import('../src/index.js');

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
        AuditLog.findAndCountAll.mockResolvedValue(mockDbResponse);

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
        
        AuditLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await request(app)
            .get('/history')
            .set('x-org-id', 'ORG-A') // <--- User is from ORG-A
            .set('x-user-id', 'user-1')
            .set('x-role', 'user');

        // CHECKING SECURITY:
        // Was the database function called with a filter organizationId: 'ORG-A'?
        expect(AuditLog.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                organizationId: 'ORG-A'
            })
        }));
    });

    it('should allow filtering by search query', async () => {
        AuditLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await request(app)
            .get('/history?search=Putin')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        // Check if search filter was added
        // Note: Sequelize uses Symbols for operators (Op.iLike), 
        // so we only check if the where structure contains searchQuery.
        const callArgs = AuditLog.findAndCountAll.mock.calls[0][0];
        expect(callArgs.where).toHaveProperty('searchQuery');
    });

    it('should allow superadmin to access without x-org-id', async () => {
        AuditLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        const res = await request(app)
            .get('/history')
            .set('x-role', 'superadmin');

        expect(res.statusCode).toBe(200);
        // Should not filter by organizationId for superadmin
        expect(AuditLog.findAndCountAll).toHaveBeenCalled();
    });

    it('should filter by organization for superadmin when orgId provided', async () => {
        AuditLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await request(app)
            .get('/history?orgId=specific-org')
            .set('x-role', 'superadmin');

        expect(AuditLog.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                organizationId: 'specific-org'
            })
        }));
    });

    it('should filter by hasHit parameter', async () => {
        AuditLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await request(app)
            .get('/history?hasHit=true')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        const callArgs = AuditLog.findAndCountAll.mock.calls[0][0];
        expect(callArgs.where.hasHit).toBe(true);
    });

    it('should filter by hasHit=false parameter', async () => {
        AuditLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await request(app)
            .get('/history?hasHit=false')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        const callArgs = AuditLog.findAndCountAll.mock.calls[0][0];
        expect(callArgs.where.hasHit).toBe(false);
    });

    it('should filter by userId parameter', async () => {
        AuditLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await request(app)
            .get('/history?userId=user-123')
            .set('x-org-id', 'org-1')
            .set('x-role', 'admin');

        expect(AuditLog.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                userId: 'user-123'
            })
        }));
    });

    it('should filter by date range (startDate and endDate)', async () => {
        AuditLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await request(app)
            .get('/history?startDate=2024-01-01&endDate=2024-12-31')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        const callArgs = AuditLog.findAndCountAll.mock.calls[0][0];
        expect(callArgs.where.createdAt).toBeDefined();
    });

    it('should use default pagination values when not provided', async () => {
        AuditLog.findAndCountAll.mockResolvedValue({ count: 10, rows: Array(10).fill({}) });

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
        expect(AuditLog.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
            limit: 20,
            offset: 0
        }));
    });

    it('should handle page beyond available data', async () => {
        AuditLog.findAndCountAll.mockResolvedValue({ count: 10, rows: [] });

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
        AuditLog.findAndCountAll.mockRejectedValue(new Error('Database connection lost'));

        const res = await request(app)
            .get('/history')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe('Internal Server Error');
        expect(res.body.requestId).toBeDefined();
    });
});