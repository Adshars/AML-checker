import { jest } from '@jest/globals';

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.YENTE_API_URL = 'http://localhost:8000';

// Mock configuration
const mockSearch = jest.fn();

// YenteClient mock
jest.unstable_mockModule('../src/clients/YenteClient.js', () => ({
    default: class {
        search(params) {
            return mockSearch(params);
        }
    }
}));

// Logger mock (to avoid cluttering the console during tests)
jest.unstable_mockModule('../src/utils/logger.js', () => ({
    default: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

// Imports (Dynamic imports after mocks)
const request = (await import('supertest')).default;
const { app } = await import('../src/index.js');

describe('OP-Adapter Integration Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockSearch.mockReset();
    });

    // ========================================
    // 1. DATA MAPPING (DTO) TESTS
    // ========================================

    describe('Data Mapping (DTO) - Yente Response Transformation', () => {

        it('should correctly map Yente response with all fields populated', async () => {
            // Mock Yente response with rich data
            const yenteResponse = {
                hits_count: 1,
                meta: { source: 'OpenSanctions (Yente)' },
                results: [
                    {
                        id: 'res-123',
                        caption: 'Vladimir Putin',
                        schema: 'Person',
                        score: 0.99,
                        datasets: ['ru-fsin-sdn', 'us-ofac-sdn'],
                        properties: {
                            topics: ['sanction', 'role.pep'],
                            birthDate: ['1952-10-07'],
                            birthPlace: ['Leningrad, USSR'],
                            gender: ['M'],
                            nationality: ['Russian'],
                            country: ['RU'],
                            position: ['President of Russia'],
                            notes: ['Leader of Russian Federation'],
                            alias: ['Vladimir Vladimirovich Putin', 'Wladimir Putin'],
                            address: ['Moscow, Russia']
                        }
                    }
                ]
            };

            mockSearch.mockResolvedValue(yenteResponse);

            const res = await request(app)
                .get('/check?name=Vladimir%20Putin');

            expect(res.statusCode).toBe(200);
            expect(res.body.hits_count).toBe(1);
            expect(res.body.data).toHaveLength(1);

            // Verify DTO mapping
            const mapped = res.body.data[0];
            expect(mapped.id).toBe('res-123');
            expect(mapped.name).toBe('Vladimir Putin');
            expect(mapped.schema).toBe('Person');
            expect(mapped.country).toEqual(['RU']);
            expect(mapped.datasets).toEqual(['ru-fsin-sdn', 'us-ofac-sdn']);
            
            // Verify properties object contains all Yente data
            expect(mapped.properties).toBeDefined();
            expect(mapped.properties.topics).toEqual(['sanction', 'role.pep']);
            expect(mapped.properties.birthDate).toEqual(['1952-10-07']);
            expect(mapped.properties.birthPlace).toEqual(['Leningrad, USSR']);
            expect(mapped.properties.gender).toEqual(['M']);
            expect(mapped.properties.nationality).toEqual(['Russian']);
            expect(mapped.properties.country).toEqual(['RU']);
            expect(mapped.properties.position).toEqual(['President of Russia']);
            expect(mapped.properties.notes).toEqual(['Leader of Russian Federation']);
            expect(mapped.properties.alias).toEqual(['Vladimir Vladimirovich Putin', 'Wladimir Putin']);
            expect(mapped.properties.address).toEqual(['Moscow, Russia']);
        });

        it('should handle sparse Yente response (missing optional fields)', async () => {
            // Yente response with minimal data
            const yenteResponse = {
                results: [
                    {
                        id: 'res-456',
                        caption: 'John Doe',
                        schema: 'Person',
                        score: 0.45,
                        datasets: [],
                        properties: {
                            topics: [''], // No specific topic (not sanctioned, not PEP)
                            country: ['US']
                        }
                    }
                ]
            };

            mockSearch.mockResolvedValue(yenteResponse);

            const res = await request(app)
                .get('/check?name=John%20Doe');

            expect(res.statusCode).toBe(200);
            
            const mapped = res.body.data[0];
            expect(mapped.properties).toBeDefined();
            expect(mapped.properties.topics).toEqual(['']);
            expect(mapped.properties.country).toEqual(['US']);
            expect(mapped.properties.birthDate).toBeUndefined();
            expect(mapped.properties.birthPlace).toBeUndefined();
            expect(mapped.properties.gender).toBeUndefined();
            expect(mapped.properties.nationality).toBeUndefined();
            expect(mapped.properties.position).toBeUndefined();
            expect(mapped.properties.notes).toBeUndefined();
            expect(mapped.properties.alias).toBeUndefined();
            expect(mapped.properties.address).toBeUndefined();
        });

        it('should extract first value from multi-valued properties', async () => {
            const yenteResponse = {
                results: [
                    {
                        id: 'res-789',
                        caption: 'Test Person',
                        schema: 'Company',
                        score: 0.70,
                        datasets: [],
                        properties: {
                            topics: [],
                            birthDate: ['1980-01-01', '1980-01-02'], // Multiple values
                            birthPlace: ['City A', 'City B'] // Multiple values
                        }
                    }
                ]
            };

            mockSearch.mockResolvedValue(yenteResponse);

            const res = await request(app)
                .get('/check?name=Test%20Person');

            expect(res.statusCode).toBe(200);
            const mapped = res.body.data[0];
            expect(mapped.properties.birthDate).toEqual(['1980-01-01', '1980-01-02']); // All values preserved
            expect(mapped.properties.birthPlace).toEqual(['City A', 'City B']); // All values preserved
        });

        it('should return empty data array when Yente finds no results', async () => {
            const yenteResponse = {
                results: []
            };

            mockSearch.mockResolvedValue(yenteResponse);

            const res = await request(app)
                .get('/check?name=NonExistent');

            expect(res.statusCode).toBe(200);
            expect(res.body.hits_count).toBe(0);
            expect(res.body.data).toEqual([]);
        });
    });

    // ========================================
    // 2. ERROR HANDLING (YENTE FAILURES) TESTS
    // ========================================

    describe('Error Handling - Yente API Failures', () => {

        it('should return 502 when Yente throws upstream error', async () => {
            const yenteError = new Error('Internal Server Error');
            mockSearch.mockRejectedValue(yenteError);

            const res = await request(app)
                .get('/check?name=Putin');

            expect(res.statusCode).toBe(502); // Bad Gateway
            expect(res.body.error).toBeDefined();
        });

        it('should return 502 when Yente is unreachable (network error)', async () => {
            const networkError = new Error('Network Timeout');
            networkError.code = 'ECONNREFUSED';

            mockSearch.mockRejectedValue(networkError);

            const res = await request(app)
                .get('/check?name=Putin');

            expect(res.statusCode).toBe(502);
            expect(res.body.error).toBeDefined();
        });

        it('should tolerate missing results and return empty array', async () => {
            const malformedResponse = { meta: { source: 'yente' } };
            mockSearch.mockResolvedValue(malformedResponse);

            const res = await request(app)
                .get('/check?name=Putin');

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toEqual([]);
            expect(res.body.hits_count).toBe(0);
        });

        it('should return 400 when name parameter is missing', async () => {
            const res = await request(app)
                .get('/check');

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toMatch(/Missing name parameter/i);
            // Verify Yente was NOT called
            expect(mockSearch).not.toHaveBeenCalled();
        });

        it('should return 502 when Yente returns 503 Service Unavailable', async () => {
            const yenteError = new Error('Service Unavailable');
            yenteError.response = { status: 503 };
            mockSearch.mockRejectedValue(yenteError);

            const res = await request(app)
                .get('/check?name=Putin');

            expect(res.statusCode).toBe(502);
        });
    });

    // ========================================
    // 3. LIMIT VALIDATION & EDGE CASES TESTS
    // ========================================

    describe('Limit Validation - Edge Cases and Boundary Testing', () => {

        it('should clamp negative limit to 1', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&limit=-5');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                limit: 1
            }));
        });

        it('should clamp limit of 0 to 1', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&limit=0');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                limit: 1
            }));
        });

        it('should clamp limit exceeding MAX_LIMIT (100) to 100', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&limit=150');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                limit: 100
            }));
        });

        it('should clamp extremely large limit (1000) to 100', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&limit=1000');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                limit: 100
            }));
        });

        it('should accept valid limit at boundary (1)', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&limit=1');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                limit: 1
            }));
        });

        it('should accept valid limit at upper boundary (100)', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&limit=100');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                limit: 100
            }));
        });
    });

    // ========================================
    // 4. BOOLEAN CONVERSION (toBoolean) TESTS
    // ========================================

    describe('Boolean Conversion - toBoolean Helper Edge Cases', () => {

        it('should convert string "true" to boolean true', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&fuzzy=true');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                fuzzy: true
            }));
        });

        it('should convert string "false" to boolean false', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&fuzzy=false');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                fuzzy: false
            }));
        });

        it('should treat non-true string values as false', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&fuzzy=yes');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                fuzzy: false
            }));
        });

        it('should treat empty fuzzy parameter as false', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&fuzzy=');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                fuzzy: false
            }));
        });
    });

    // ========================================
    // 5. PARAMETER PASSING TESTS
    // ========================================

    describe('Parameter Passing - Query Parameter Forwarding to Yente', () => {

        it('should pass name parameter to Yente', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Vladimir%20Putin');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                name: 'Vladimir Putin',
                limit: 15,
                fuzzy: false,
                schema: undefined,
                country: undefined,
                requestId: expect.any(String)
            }));
        });

        it('should pass limit parameter (custom value)', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&limit=50');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                limit: 50
            }));
        });

        it('should use default limit when not provided', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                limit: 15
            }));
        });

        it('should pass fuzzy parameter as boolean true', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&fuzzy=true');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                fuzzy: true
            }));
        });

        it('should pass fuzzy parameter as boolean false', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&fuzzy=false');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                fuzzy: false
            }));
        });

        it('should pass country parameter as countries in Yente URL', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&country=RU');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                country: 'RU'
            }));
        });

        it('should pass schema parameter without modification', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&schema=Person');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                schema: 'Person'
            }));
        });

        it('should not include optional parameters when not provided', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin');

            const callArgs = mockSearch.mock.calls[0][0];
            expect(callArgs.name).toBe('Putin');
            expect(callArgs.limit).toBe(15);
            expect(callArgs.fuzzy).toBe(false);
            expect(callArgs.country).toBeUndefined();
            expect(callArgs.schema).toBeUndefined();
        });

        it('should combine multiple parameters correctly', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockSearch.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=John%20Doe&limit=25&fuzzy=true&country=US&schema=Person');

            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                name: 'John Doe',
                limit: 25,
                fuzzy: true,
                country: 'US',
                schema: 'Person'
            }));
        });
    });

    // ========================================
    // 6. RESPONSE STRUCTURE TESTS
    // ========================================

    describe('Response Structure - Adapter Response Format', () => {

        it('should include request tracking ID in response', async () => {
            const successResponse = {
                data: { results: [] },
                meta: { source: 'OpenSanctions (Yente)', requestId: 'custom-req-id' }
            };

            mockSearch.mockResolvedValue(successResponse);

            const res = await request(app)
                .get('/check?name=Putin')
                .set('x-request-id', 'custom-req-id');

            expect(res.body.meta).toBeDefined();
            expect(res.body.meta.requestId).toBe('custom-req-id');
        });

        it('should auto-generate request ID if not provided', async () => {
            const successResponse = {
                data: { results: [] },
                meta: { source: 'OpenSanctions (Yente)' }
            };

            mockSearch.mockResolvedValue(successResponse);

            const res = await request(app)
                .get('/check?name=Putin');

            expect(res.body.meta.requestId).toBeDefined();
            expect(res.body.meta.requestId).toMatch(/^req-/); // Auto-generated format
        });

        it('should include metadata with timestamp and source', async () => {
            const successResponse = {
                data: { results: [] },
                meta: { source: 'OpenSanctions (Yente)' }
            };

            mockSearch.mockResolvedValue(successResponse);

            const res = await request(app)
                .get('/check?name=Putin');

            expect(res.body.meta.timestamp).toBeDefined();
            expect(res.body.meta.source).toBe('OpenSanctions (Yente)');
            expect(new Date(res.body.meta.timestamp).getTime()).toBeGreaterThan(0);
        });

        it('should include search parameters used in response', async () => {
            const successResponse = {
                data: { results: [] },
                meta: { source: 'OpenSanctions (Yente)' }
            };

            mockSearch.mockResolvedValue(successResponse);

            const res = await request(app)
                .get('/check?name=Putin&limit=20&fuzzy=true&country=RU&schema=Person');

            expect(res.body.search_params).toEqual({
                limit: 20,
                fuzzy: true,
                schema: 'Person',
                country: 'RU'
            });
        });

        it('should include original query string', async () => {
            const successResponse = {
                data: { results: [] },
                meta: { source: 'OpenSanctions (Yente)' }
            };

            mockSearch.mockResolvedValue(successResponse);

            const res = await request(app)
                .get('/check?name=Vladimir%20Putin&limit=10');

            expect(res.body.query).toBe('Vladimir Putin');
        });
    });

    // ========================================
    // 7. HEALTH CHECK ENDPOINT TESTS
    // ========================================

    describe('Health Check Endpoint', () => {

        it('should return UP status', async () => {
            const res = await request(app)
                .get('/health');

            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe('UP');
            expect(res.body.service).toBe('op-adapter');
            expect(res.body.mode).toBe('ES Modules + Retry');
        });

        it('should not require authentication', async () => {
            const res = await request(app)
                .get('/health');

            expect(res.statusCode).toBe(200);
        });
    });
});
