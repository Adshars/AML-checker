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
});