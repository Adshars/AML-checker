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
let app: import('express').Application;
beforeAll(async () => {
    const application = new Application();
    await application.initialize();
    app = application.getApp();
});

describe('GET /history/export Integration Test', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 403 if x-org-id is missing (Security)', async () => {
        const res = await request(app).get('/history/export');
        expect(res.statusCode).toBe(403);
    });

    it('should return a CSV file with the correct content type', async () => {
        mockAuditLogModel.findAll.mockResolvedValue([]);

        const res = await request(app)
            .get('/history/export')
            .set('x-org-id', 'org-123')
            .set('x-role', 'user');

        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.text.charCodeAt(0)).toBe(0xfeff);
    });

    it('should fetch all matching rows without pagination (no limit/offset)', async () => {
        mockAuditLogModel.findAll.mockResolvedValue([]);

        await request(app)
            .get('/history/export')
            .set('x-org-id', 'org-123')
            .set('x-role', 'user');

        expect(mockAuditLogModel.findAndCountAll).not.toHaveBeenCalled();
        const callArgs = mockAuditLogModel.findAll.mock.calls[0][0] as Record<string, unknown>;
        expect(callArgs.limit).toBeUndefined();
        expect(callArgs.offset).toBeUndefined();
    });

    it('should enforce data isolation for regular users', async () => {
        mockAuditLogModel.findAll.mockResolvedValue([]);

        await request(app)
            .get('/history/export')
            .set('x-org-id', 'ORG-A')
            .set('x-role', 'user');

        expect(mockAuditLogModel.findAll).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ organizationId: 'ORG-A' })
        }));
    });

    it('should allow superadmin to access without x-org-id', async () => {
        mockAuditLogModel.findAll.mockResolvedValue([]);

        const res = await request(app)
            .get('/history/export')
            .set('x-role', 'superadmin');

        expect(res.statusCode).toBe(200);
        const callArgs = mockAuditLogModel.findAll.mock.calls[0][0] as { where: Record<string, unknown> };
        expect(callArgs.where.organizationId).toBeUndefined();
    });

    it('should apply search, hasHit and date range filters', async () => {
        mockAuditLogModel.findAll.mockResolvedValue([]);

        await request(app)
            .get('/history/export?search=Putin&hasHit=true&startDate=2026-07-01&endDate=2026-07-31')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        const callArgs = mockAuditLogModel.findAll.mock.calls[0][0] as { where: Record<string, unknown> };
        expect(callArgs.where).toHaveProperty('searchQuery');
        expect(callArgs.where.hasHit).toBe(true);
        expect(callArgs.where.createdAt).toBeDefined();
    });

    it('should name the file using the date range when both filters are provided', async () => {
        mockAuditLogModel.findAll.mockResolvedValue([]);

        const res = await request(app)
            .get('/history/export?startDate=2026-07-01&endDate=2026-07-31')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        expect(res.headers['content-disposition']).toContain('aml-history-2026-07-01_2026-07-31.csv');
    });

    it('should name the file using today\'s date when no date filters are provided', async () => {
        mockAuditLogModel.findAll.mockResolvedValue([]);

        const today = new Date().toISOString().slice(0, 10);
        const res = await request(app)
            .get('/history/export')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        expect(res.headers['content-disposition']).toContain(`aml-history-${today}.csv`);
    });

    it('should return 500 on database error', async () => {
        mockAuditLogModel.findAll.mockRejectedValue(new Error('Database connection lost'));

        const res = await request(app)
            .get('/history/export')
            .set('x-org-id', 'org-1')
            .set('x-role', 'user');

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe('Internal Server Error');
    });
});
