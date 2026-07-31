import { jest } from '@jest/globals';
import { Op } from 'sequelize';

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
let app: import('express').Application;
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

        // Verify correct queries were made, each scoped to the organization
        // and windowed to the last 30 days (see dedicated 30-day test below
        // for the exact cutoff value).
        expect(mockAuditLogModel.count).toHaveBeenCalledTimes(3);
        const [totalArgs, sanctionArgs, pepArgs] = mockAuditLogModel.count.mock.calls.map(
            (call) => (call[0] as { where: Record<string, unknown> }).where
        );
        expect(totalArgs).toMatchObject({ organizationId: 'org-123' });
        expect(totalArgs.createdAt).toBeDefined();
        expect(sanctionArgs).toMatchObject({ organizationId: 'org-123', isSanctioned: true });
        expect(sanctionArgs.createdAt).toBeDefined();
        expect(pepArgs).toMatchObject({ organizationId: 'org-123', isPep: true });
        expect(pepArgs.createdAt).toBeDefined();

        const findAllArgs = mockAuditLogModel.findAll.mock.calls[0][0] as {
            where: Record<string, unknown>;
            order: unknown;
            limit: number;
            attributes: string[];
        };
        expect(findAllArgs.where).toMatchObject({ organizationId: 'org-123' });
        expect(findAllArgs.where.createdAt).toBeDefined();
        expect(findAllArgs.order).toEqual([['createdAt', 'DESC']]);
        expect(findAllArgs.limit).toBe(100);
        expect(findAllArgs.attributes).toEqual(['id', 'searchQuery', 'isSanctioned', 'isPep', 'createdAt']);
    });

    it('should scope all stats queries to the last 30 days', async () => {
        const fixedNow = new Date('2026-02-15T12:00:00.000Z');
        jest.useFakeTimers().setSystemTime(fixedNow);

        mockAuditLogModel.count.mockResolvedValue(0);
        mockAuditLogModel.findAll.mockResolvedValue([]);

        await request(app).get('/stats').set('x-org-id', 'org-123');

        const expectedCutoff = new Date(fixedNow.getTime() - 30 * 24 * 60 * 60 * 1000);

        for (const call of mockAuditLogModel.count.mock.calls) {
            const where = (call[0] as { where: { createdAt: { [key: symbol]: Date } } }).where;
            const gte = where.createdAt[Op.gte];
            expect(gte).toEqual(expectedCutoff);
        }

        const findAllWhere = (mockAuditLogModel.findAll.mock.calls[0][0] as {
            where: { createdAt: { [key: symbol]: Date } };
        }).where;
        expect(findAllWhere.createdAt[Op.gte]).toEqual(expectedCutoff);

        jest.useRealTimers();
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
