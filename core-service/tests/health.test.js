import { jest } from '@jest/globals';

// Mock SequelizeConnection
const mockIsHealthy = jest.fn();
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
        async isHealthy() { return mockIsHealthy(); }
    }
}));

// OpAdapterClient mock
const mockOpAdapterIsHealthy = jest.fn();
jest.unstable_mockModule('../src/infrastructure/clients/OpAdapterClient.js', () => ({
    OpAdapterClient: class {
        constructor() {}
        async checkSanctions() { return { data: { hits_count: 0, data: [] }, duration: 10 }; }
        async isHealthy() { return mockOpAdapterIsHealthy(); }
    }
}));

// AuditLog model mock
const mockAuditLogModel = {
    create: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn()
};

jest.unstable_mockModule('../src/infrastructure/database/sequelize/models/AuditLogModel.js', () => ({
    createAuditLogModel: () => mockAuditLogModel
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

describe('GET /health Integration Test', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockIsHealthy.mockResolvedValue(true);
        mockOpAdapterIsHealthy.mockResolvedValue(true);
    });

    it('should return healthy status with connected database', async () => {
        mockIsHealthy.mockResolvedValue(true);

        const res = await request(app).get('/health');

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            service: 'core-service',
            status: 'UP',
            database: 'Connected'
        });
    });

    it('should return healthy status with disconnected database', async () => {
        mockIsHealthy.mockResolvedValue(false);

        const res = await request(app).get('/health');

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            service: 'core-service',
            status: 'UP',
            database: 'Disconnected'
        });
    });
});
