import { jest } from '@jest/globals';

// Mock sequelize (database connection)
const mockAuthenticate = jest.fn();
jest.unstable_mockModule('../src/config/database.js', () => ({
    default: {
        authenticate: mockAuthenticate
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

// AuditLog mock (needed for app initialization)
jest.unstable_mockModule('../src/models/AuditLog.js', () => ({
    default: {
        count: jest.fn(),
        findAll: jest.fn()
    }
}));

// Imports
const request = (await import('supertest')).default;
const { app } = await import('../src/index.js');

describe('GET /health Integration Test', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return healthy status with connected database', async () => {
        mockAuthenticate.mockResolvedValue(); // Database connection successful

        const res = await request(app).get('/health');

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            service: 'core-service',
            status: 'UP',
            database: 'Connected'
        });

        expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    });

    it('should return healthy status with disconnected database', async () => {
        mockAuthenticate.mockRejectedValue(new Error('Connection refused')); // Database connection failed

        const res = await request(app).get('/health');

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            service: 'core-service',
            status: 'UP',
            database: 'Disconnected'
        });

        expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    });
});
