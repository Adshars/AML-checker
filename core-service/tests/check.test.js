import { jest } from '@jest/globals';

// Define Mocks BEFORE importing the app

// OpAdapterClient mock
const mockCheckSanctions = jest.fn();
jest.unstable_mockModule('../src/clients/OpAdapterClient.js', () => ({
    default: class {
        checkSanctions(payload) { return mockCheckSanctions(payload); }
    }
}));

// AuditLog model mock
jest.unstable_mockModule('../src/models/AuditLog.js', () => ({
    default: {
        create: jest.fn()
    }
}));

// Logger mock (to avoid cluttering the console during tests)
jest.unstable_mockModule('../src/utils/logger.js', () => ({
    default: {
        info: jest.fn(),
        warn: jest.fn(), // You can uncomment if you want to see warnings
        debug: jest.fn(),
        error: jest.fn() // You can uncomment if you want to see errors
    }
}));

// IMPORT THE APP AND LIBRARIES NOW
// We use await import to ensure mocks are already in place

const request = (await import('supertest')).default;
const { default: OpAdapterClient } = await import('../src/clients/OpAdapterClient.js');
const AuditLog = (await import('../src/models/AuditLog.js')).default;
const { app } = await import('../src/index.js'); // Import the app last

describe('GET /check Integration Test', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        mockCheckSanctions.mockResolvedValue({
            data: { hits_count: 0, data: [] },
            duration: 50
        });
    });

    it('should return 400 if name is missing', async () => {
        const res = await request(app)
            .get('/check')
            .set('x-org-id', 'test-org')
            .set('x-user-id', 'test-user');
        
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/Missing name parameter/i);
    });

    it('should return 403 if x-org-id is missing', async () => {
        const res = await request(app).get('/check?name=Putin');
        expect(res.statusCode).toBe(403);
    });

    it('should process successful response from Op-Adapter and save log', async () => {
        
        // SCENARIO: We simulate that Op-Adapter returned correct data
        const mockAdapterResponse = {
            data: {
                hits_count: 1,
                data: [
                    {
                        name: 'Vladimir Putin',
                        score: 1.0,
                        birthDate: '1952-10-07',
                        country: ['RU'],
                        datasets: ['ofac'],
                        notes: ['President'],
                        isSanctioned: true,
                        isPep: false
                    }
                ]
            },
            duration: 120
        };

        // Configure the mock
        mockCheckSanctions.mockResolvedValue(mockAdapterResponse);

        // Make the request
        const res = await request(app)
            .get('/check?name=Putin')
            .set('x-org-id', 'org-123')
            .set('x-user-id', 'user-456');


        // Assertions
        expect(res.statusCode).toBe(200);
        expect(res.body.hits_count).toBe(1);
        expect(res.body.data[0].name).toBe('Vladimir Putin');

        // Check if AuditLog.create was called correctly
        expect(AuditLog.create).toHaveBeenCalledTimes(1);
        expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: 'org-123',
            userId: 'user-456',
            searchQuery: 'Putin',
            entityName: 'Vladimir Putin',
            entityBirthDate: '1952-10-07',
            entityCountries: 'RU',
            entityDatasets: 'ofac',
            isSanctioned: true,
            isPep: false,
            hasHit: true,
            hitsCount: 1
        }));
    });
});