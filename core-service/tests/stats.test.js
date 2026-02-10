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

describe('GET /stats Integration Test', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return statistics for organization (Happy Path)', async () => {
        // Mock statistics data
        mockAuditLogModel.count.mockResolvedValueOnce(150); // totalChecks
        mockAuditLogModel.count.mockResolvedValueOnce(25);  // sanctionHits
        mockAuditLogModel.count.mockResolvedValueOnce(10);  // pepHits

        const mockRecentLogs = [
            { id: 1, searchQuery: 'John Doe', isSanctioned: false, isPep: false, createdAt: '2026-01-27T12:00:00.000Z' },
            { id: 2, searchQuery: 'Vladimir Putin', isSanctioned: true, isPep: true, createdAt: '2026-01-27T12:00:00.000Z' },
            { id: 3, searchQuery: 'Test Person', isSanctioned: false, isPep: false, createdAt: '2026-01-27T12:00:00.000Z' }
        ];
        mockAuditLogModel.findAll.mockResolvedValue(mockRecentLogs);

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
        expect(mockAuditLogModel.count).toHaveBeenCalledTimes(3);
        expect(mockAuditLogModel.count).toHaveBeenNthCalledWith(1, { where: { organizationId: 'org-123' } });
        expect(mockAuditLogModel.count).toHaveBeenNthCalledWith(2, { where: { organizationId: 'org-123', isSanctioned: true } });
        expect(mockAuditLogModel.count).toHaveBeenNthCalledWith(3, { where: { organizationId: 'org-123', isPep: true } });

        expect(mockAuditLogModel.findAll).toHaveBeenCalledWith({
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
        mockAuditLogModel.count.mockResolvedValue(0);
        mockAuditLogModel.findAll.mockResolvedValue([]);

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
        mockAuditLogModel.count.mockResolvedValue(42);
        mockAuditLogModel.findAll.mockResolvedValue([]);

        await request(app)
            .get('/stats')
            .set('x-org-id', 'org-456');

        // Verify all queries included organizationId filter
        expect(mockAuditLogModel.count).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                organizationId: 'org-456'
            })
        }));

        expect(mockAuditLogModel.findAll).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                organizationId: 'org-456'
            })
        }));
    });

    it('should return 500 on database error', async () => {
        mockAuditLogModel.count.mockRejectedValue(new Error('Database connection lost'));

        const res = await request(app)
            .get('/stats')
            .set('x-org-id', 'org-123');

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe('Internal Server Error');
    });
});
