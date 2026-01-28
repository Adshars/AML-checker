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

    it('should return empty results when no matches found', async () => {
        mockCheckSanctions.mockResolvedValue({
            data: { hits_count: 0, data: [] },
            duration: 45
        });

        const res = await request(app)
            .get('/check?name=UnknownPerson')
            .set('x-org-id', 'org-123')
            .set('x-user-id', 'user-456');

        expect(res.statusCode).toBe(200);
        expect(res.body.hits_count).toBe(0);
        expect(res.body.data).toEqual([]);

        // AuditLog should still be created with hasHit=false
        expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            hasHit: false,
            hitsCount: 0,
            isSanctioned: false,
            isPep: false
        }));
    });

    it('should handle multiple matches correctly', async () => {
        mockCheckSanctions.mockResolvedValue({
            data: {
                hits_count: 3,
                data: [
                    { name: 'John Smith', score: 0.95, isSanctioned: true, isPep: false, datasets: ['ofac'] },
                    { name: 'John Smithson', score: 0.85, isSanctioned: false, isPep: true, datasets: ['pep'] },
                    { name: 'Johnny Smith', score: 0.75, isSanctioned: false, isPep: false, datasets: ['watchlist'] }
                ]
            },
            duration: 80
        });

        const res = await request(app)
            .get('/check?name=John Smith')
            .set('x-org-id', 'org-123')
            .set('x-user-id', 'user-456');

        expect(res.statusCode).toBe(200);
        expect(res.body.hits_count).toBe(3);
        expect(res.body.data).toHaveLength(3);

        // AuditLog should save best match (first one)
        expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            entityName: 'John Smith',
            entityScore: 0.95,
            isSanctioned: true,
            hasHit: true,
            hitsCount: 3
        }));
    });

    it('should pass optional query parameters to adapter', async () => {
        mockCheckSanctions.mockResolvedValue({
            data: { hits_count: 0, data: [] },
            duration: 30
        });

        await request(app)
            .get('/check?name=Test&limit=5&fuzzy=true&schema=person&country=US')
            .set('x-org-id', 'org-123')
            .set('x-user-id', 'user-456');

        // Verify adapter was called with all parameters
        expect(mockCheckSanctions).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Test',
            limit: '5',
            fuzzy: 'true',
            schema: 'person',
            country: 'US'
        }));
    });

    it('should return 502 when Op-Adapter returns error', async () => {
        mockCheckSanctions.mockRejectedValue({
            response: { data: { error: 'Adapter validation failed' } },
            message: 'Request failed with status code 400'
        });

        const res = await request(app)
            .get('/check?name=Test')
            .set('x-org-id', 'org-123')
            .set('x-user-id', 'user-456');

        expect(res.statusCode).toBe(502);
        expect(res.body.error).toBe('Validation failed downstream');
    });

    it('should return 500 on unexpected errors', async () => {
        mockCheckSanctions.mockRejectedValue(new Error('Unexpected error'));

        const res = await request(app)
            .get('/check?name=Test')
            .set('x-org-id', 'org-123')
            .set('x-user-id', 'user-456');

        expect(res.statusCode).toBe(502);
    });

    it('should handle missing userID gracefully (API key authentication)', async () => {
        mockCheckSanctions.mockResolvedValue({
            data: { hits_count: 0, data: [] },
            duration: 25
        });

        const res = await request(app)
            .get('/check?name=Test')
            .set('x-org-id', 'org-123');
            // No x-user-id header

        expect(res.statusCode).toBe(200);
        expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'API',
            userEmail: null
        }));
    });

    it('should handle userEmail header when provided', async () => {
        mockCheckSanctions.mockResolvedValue({
            data: { hits_count: 0, data: [] },
            duration: 25
        });

        await request(app)
            .get('/check?name=Test')
            .set('x-org-id', 'org-123')
            .set('x-user-id', 'user-456')
            .set('x-user-email', 'user@example.com');

        expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user-456',
            userEmail: 'user@example.com'
        }));
    });

    it('should trim whitespace from name parameter', async () => {
        mockCheckSanctions.mockResolvedValue({
            data: { hits_count: 0, data: [] },
            duration: 20
        });

        await request(app)
            .get('/check?name=  John Doe  ')
            .set('x-org-id', 'org-123')
            .set('x-user-id', 'user-456');

        expect(mockCheckSanctions).toHaveBeenCalledWith(expect.objectContaining({
            name: 'John Doe'
        }));
    });

    it('should reject empty name after trimming', async () => {
        const res = await request(app)
            .get('/check?name=   ')
            .set('x-org-id', 'org-123')
            .set('x-user-id', 'user-456');

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/Missing name parameter/i);
    });

    it('should continue operation even if AuditLog fails', async () => {
        mockCheckSanctions.mockResolvedValue({
            data: { hits_count: 1, data: [{ name: 'Test Person', isSanctioned: true }] },
            duration: 40
        });

        // Mock AuditLog.create to fail
        AuditLog.create.mockRejectedValue(new Error('Database connection lost'));

        const res = await request(app)
            .get('/check?name=Test')
            .set('x-org-id', 'org-123')
            .set('x-user-id', 'user-456');

        // Should still return successful response to user
        expect(res.statusCode).toBe(200);
        expect(res.body.hits_count).toBe(1);
    });

    it('should map all entity fields correctly', async () => {
        mockCheckSanctions.mockResolvedValue({
            data: {
                hits_count: 1,
                data: [{
                    name: 'Vladimir Putin',
                    score: 1.0,
                    birthDate: '1952-10-07',
                    gender: 'male',
                    country: ['RU', 'SU'],
                    datasets: ['ofac', 'un-sc', 'eu-fsf'],
                    position: ['President', 'Former KGB Officer'],
                    notes: ['Subject to sanctions'],
                    description: ['Russian political figure'],
                    isSanctioned: true,
                    isPep: true
                }]
            },
            duration: 55
        });

        await request(app)
            .get('/check?name=Putin')
            .set('x-org-id', 'org-123')
            .set('x-user-id', 'user-456');

        expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            entityName: 'Vladimir Putin',
            entityScore: 1.0,
            entityBirthDate: '1952-10-07',
            entityGender: 'male',
            entityCountries: 'RU, SU',
            entityDatasets: 'ofac, un-sc, eu-fsf',
            entityDescription: 'President, Former KGB Officer Russian political figure',
            isSanctioned: true,
            isPep: true
        }));
    });
});