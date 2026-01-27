import { jest } from '@jest/globals';

// Mocking AuditLog model
jest.unstable_mockModule('../src/models/AuditLog.js', () => ({
    default: {
        count: jest.fn(),
        findAll: jest.fn()
    }
}));

// Logger mock
jest.unstable_mockModule('../src/utils/logger.js', () => ({
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

// OpAdapterClient mock (needed for app initialization)
jest.unstable_mockModule('../src/clients/OpAdapterClient.js', () => ({
    default: class {
        checkSanctions() { return Promise.resolve({ data: { hits_count: 0, data: [] }, duration: 10 }); }
    }
}));

// Imports
const request = (await import('supertest')).default;
const AuditLog = (await import('../src/models/AuditLog.js')).default;
const { app } = await import('../src/index.js');

describe('GET /stats Integration Test', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return statistics for organization (Happy Path)', async () => {
        // Mock statistics data
        AuditLog.count.mockResolvedValueOnce(150); // totalChecks
        AuditLog.count.mockResolvedValueOnce(25);  // sanctionHits
        AuditLog.count.mockResolvedValueOnce(10);  // pepHits
        
        const mockRecentLogs = [
            { id: 1, searchQuery: 'John Doe', isSanctioned: false, isPep: false, createdAt: '2026-01-27T12:00:00.000Z' },
            { id: 2, searchQuery: 'Vladimir Putin', isSanctioned: true, isPep: true, createdAt: '2026-01-27T12:00:00.000Z' },
            { id: 3, searchQuery: 'Test Person', isSanctioned: false, isPep: false, createdAt: '2026-01-27T12:00:00.000Z' }
        ];
        AuditLog.findAll.mockResolvedValue(mockRecentLogs);

        const res = await request(app)
            .get('/stats')
            .set('x-org-id', 'org-123');

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            totalChecks: 150,
            sanctionHits: 25,
            pepHits: 10,
            recentLogs: mockRecentLogs
        });

        // Verify correct queries were made
        expect(AuditLog.count).toHaveBeenCalledTimes(3);
        expect(AuditLog.count).toHaveBeenNthCalledWith(1, { where: { organizationId: 'org-123' } });
        expect(AuditLog.count).toHaveBeenNthCalledWith(2, { where: { organizationId: 'org-123', isSanctioned: true } });
        expect(AuditLog.count).toHaveBeenNthCalledWith(3, { where: { organizationId: 'org-123', isPep: true } });
        
        expect(AuditLog.findAll).toHaveBeenCalledWith({
            where: { organizationId: 'org-123' },
            order: [['createdAt', 'DESC']],
            limit: 100,
            attributes: ['id', 'searchQuery', 'isSanctioned', 'isPep', 'createdAt']
        });
    });

    it('should return 400 if x-org-id is missing', async () => {
        const res = await request(app).get('/stats');

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Missing organization ID');
    });

    it('should handle organization with no data', async () => {
        AuditLog.count.mockResolvedValue(0);
        AuditLog.findAll.mockResolvedValue([]);

        const res = await request(app)
            .get('/stats')
            .set('x-org-id', 'new-org');

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            totalChecks: 0,
            sanctionHits: 0,
            pepHits: 0,
            recentLogs: []
        });
    });

    it('should enforce data isolation (only stats for specified org)', async () => {
        AuditLog.count.mockResolvedValue(42);
        AuditLog.findAll.mockResolvedValue([]);

        await request(app)
            .get('/stats')
            .set('x-org-id', 'org-456');

        // Verify all queries included organizationId filter
        expect(AuditLog.count).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                organizationId: 'org-456'
            })
        }));

        expect(AuditLog.findAll).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                organizationId: 'org-456'
            })
        }));
    });

    it('should return 500 on database error', async () => {
        AuditLog.count.mockRejectedValue(new Error('Database connection lost'));

        const res = await request(app)
            .get('/stats')
            .set('x-org-id', 'org-123');

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe('Internal Server Error');
    });
});
