import { jest } from '@jest/globals';

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.YENTE_API_URL = 'http://localhost:8000';

// Mock configuration

// Axios mock - we'll control responses per test
const mockAxiosGet = jest.fn();
const mockAxiosCreate = jest.fn().mockImplementation(() => ({
    get: mockAxiosGet
}));

jest.unstable_mockModule('axios', () => ({
    default: {
        create: mockAxiosCreate
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

// Axios-retry mock - simulates retry behavior with simple loop
let lastRetryConfig = null;

const isNetworkOrIdempotentRequestError = jest.fn((error) => {
    return !error.response || error.response.status >= 500;
});

const axiosRetryMock = (client, config) => {
    lastRetryConfig = config;
    const originalGet = client.get;

    // Wrap get with retry logic similar to axios-retry
    client.get = async (...args) => {
        let retryCount = 0;
        while (true) {
            try {
                return await originalGet(...args);
            } catch (err) {
                const shouldRetry = (config.retryCondition && config.retryCondition(err)) || false;
                if (!shouldRetry || retryCount >= (config.retries ?? 0)) {
                    throw err;
                }
                retryCount += 1;
                if (config.onRetry) {
                    config.onRetry(retryCount, err, args[0]);
                }
                // No delay in tests
            }
        }
    };

    client._retryConfig = config;
    return client;
};

// Attach helper to default export to mirror library usage (axiosRetry.isNetworkOrIdempotentRequestError)
axiosRetryMock.isNetworkOrIdempotentRequestError = isNetworkOrIdempotentRequestError;
axiosRetryMock.exponentialDelay = () => 0; // no-op delay for tests

jest.unstable_mockModule('axios-retry', () => ({
    default: axiosRetryMock,
    isNetworkOrIdempotentRequestError,
    exponentialDelay: axiosRetryMock.exponentialDelay,
    getLastRetryConfig: () => lastRetryConfig,
    __resetRetryConfig: () => { lastRetryConfig = null; }
}));

// Imports (Dynamic imports after mocks)
const request = (await import('supertest')).default;
const axios = (await import('axios')).default;
const axiosRetryModule = await import('axios-retry');
const axiosRetry = axiosRetryModule.default;
const { getLastRetryConfig } = axiosRetryModule;
const { app } = await import('../src/index.js');

describe('OP-Adapter Integration Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockAxiosGet.mockReset();
    });

    // ========================================
    // 1. DATA MAPPING (DTO) TESTS
    // ========================================

    describe('Data Mapping (DTO) - Yente Response Transformation', () => {

        it('should correctly map Yente response with all fields populated', async () => {
            // Mock Yente response with rich data
            const yenteResponse = {
                data: {
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
                }
            };

            mockAxiosGet.mockResolvedValue(yenteResponse);

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
            expect(mapped.score).toBe(0.99);
            expect(mapped.isSanctioned).toBe(true); // topics contains 'sanction'
            expect(mapped.isPep).toBe(true); // topics contains 'role.pep'
            expect(mapped.birthDate).toBe('1952-10-07');
            expect(mapped.birthPlace).toBe('Leningrad, USSR');
            expect(mapped.gender).toBe('M');
            expect(mapped.nationality).toEqual(['Russian']);
            expect(mapped.country).toEqual(['RU']);
            expect(mapped.position).toEqual(['President of Russia']);
            expect(mapped.description).toEqual(['Leader of Russian Federation']);
            expect(mapped.aliases).toEqual(['Vladimir Vladimirovich Putin', 'Wladimir Putin']);
            expect(mapped.addresses).toEqual(['Moscow, Russia']);
            expect(mapped.datasets).toEqual(['ru-fsin-sdn', 'us-ofac-sdn']);
        });

        it('should handle sparse Yente response (missing optional fields)', async () => {
            // Yente response with minimal data
            const yenteResponse = {
                data: {
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
                }
            };

            mockAxiosGet.mockResolvedValue(yenteResponse);

            const res = await request(app)
                .get('/check?name=John%20Doe');

            expect(res.statusCode).toBe(200);
            
            const mapped = res.body.data[0];
            expect(mapped.isSanctioned).toBe(false);
            expect(mapped.isPep).toBe(false);
            expect(mapped.birthDate).toBeNull();
            expect(mapped.birthPlace).toBeNull();
            expect(mapped.gender).toBeNull();
            expect(mapped.nationality).toEqual([]);
            expect(mapped.position).toEqual([]);
            expect(mapped.description).toEqual([]);
            expect(mapped.aliases).toEqual([]);
            expect(mapped.addresses).toEqual([]);
        });

        it('should extract first value from multi-valued properties', async () => {
            const yenteResponse = {
                data: {
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
                }
            };

            mockAxiosGet.mockResolvedValue(yenteResponse);

            const res = await request(app)
                .get('/check?name=Test%20Person');

            expect(res.statusCode).toBe(200);
            const mapped = res.body.data[0];
            expect(mapped.birthDate).toBe('1980-01-01'); // First value only
            expect(mapped.birthPlace).toBe('City A'); // First value only
        });

        it('should return empty data array when Yente finds no results', async () => {
            const yenteResponse = {
                data: {
                    results: []
                }
            };

            mockAxiosGet.mockResolvedValue(yenteResponse);

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

        it('should return 502 when Yente returns 500 after retries', async () => {
            // Simulate Yente server error (even after retries)
            const yenteError = new Error('Internal Server Error');
            yenteError.response = {
                status: 500,
                data: { error: 'Yente crashed' }
            };

            mockAxiosGet.mockRejectedValue(yenteError);

            const res = await request(app)
                .get('/check?name=Putin');

            expect(res.statusCode).toBe(502); // Bad Gateway
            expect(res.body.error).toBeDefined();
        });

        it('should return 502 when Yente is unreachable (network error)', async () => {
            // Simulate network timeout
            const networkError = new Error('Network Timeout');
            networkError.code = 'ECONNREFUSED';
            networkError.response = undefined; // No HTTP response (connection failed)

            mockAxiosGet.mockRejectedValue(networkError);

            const res = await request(app)
                .get('/check?name=Putin');

            expect(res.statusCode).toBe(502);
            expect(res.body.error).toBeDefined();
        });

        it('should return 502 when Yente returns malformed response', async () => {
            // Simulate 200 OK but with invalid data structure
            const malformedResponse = {
                data: {
                    // Missing 'results' field
                    hits: []
                }
            };

            mockAxiosGet.mockResolvedValue(malformedResponse);

            const res = await request(app)
                .get('/check?name=Putin');

            // Should fail while trying to map results
            expect(res.statusCode).toBe(502);
        });

        it('should return 400 when name parameter is missing', async () => {
            const res = await request(app)
                .get('/check');

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toMatch(/Missing name parameter/i);
            // Verify Yente was NOT called
            expect(mockAxiosGet).not.toHaveBeenCalled();
        });

        it('should return 502 when Yente returns 503 Service Unavailable', async () => {
            const yenteError = new Error('Service Unavailable');
            yenteError.response = {
                status: 503,
                data: { error: 'Yente is down' }
            };

            mockAxiosGet.mockRejectedValue(yenteError);

            const res = await request(app)
                .get('/check?name=Putin');

            expect(res.statusCode).toBe(502);
        });
    });

    // ========================================
    // 3. RETRY LOGIC TESTS
    // ========================================

    describe('Retry Logic - Exponential Backoff and Recovery', () => {

        it('should succeed on retry after initial failure', async () => {
            // Simulate: 1st and 2nd call fail, 3rd call succeeds
            const successResponse = {
                data: {
                    results: [{
                        id: 'res-success',
                        caption: 'Putin',
                        schema: 'Person',
                        score: 0.95,
                        datasets: [],
                        properties: { topics: ['sanction'], country: ['RU'] }
                    }]
                }
            };

            // Mock sequential behavior: fail, then succeed
            mockAxiosGet
                .mockRejectedValueOnce(new Error('Connection timeout #1'))
                .mockRejectedValueOnce(new Error('Connection timeout #2'))
                .mockResolvedValueOnce(successResponse);

            const res = await request(app)
                .get('/check?name=Putin');

            // Should succeed despite initial failure
            expect(res.statusCode).toBe(200);
            expect(res.body.hits_count).toBe(1);
            // Verify get was called more than once (retry happened)
            expect(mockAxiosGet).toHaveBeenCalledTimes(3);
        });

        it('should retry on network errors but not on 4xx errors', async () => {
            // 400 Bad Request should NOT trigger retry (idempotency safe to skip)
            const badRequestError = new Error('Bad Request');
            badRequestError.response = {
                status: 400,
                data: { error: 'Invalid query' }
            };

            const retryConfig = getLastRetryConfig();
            expect(retryConfig.retryCondition(badRequestError)).toBe(false); // Should NOT retry
            expect(retryConfig.retryCondition({ response: { status: 503 } })).toBe(true); // 5xx should retry
        });

        it('should retry on 5xx errors', async () => {
            // 500+ errors should trigger retry (per retryCondition)
            const serverError = new Error('Server Error');
            serverError.response = {
                status: 500,
                data: { error: 'Internal error' }
            };

            const retryConfig = getLastRetryConfig();
            expect(retryConfig.retryCondition(serverError)).toBe(true); // Should retry
        });

        it('should eventually fail after max retries exhausted', async () => {
            // Simulate: all 3 retries fail
            const persistentError = new Error('Persistent Yente outage');
            persistentError.response = {
                status: 500,
                data: { error: 'Server down' }
            };

            mockAxiosGet.mockRejectedValue(persistentError);

            const res = await request(app)
                .get('/check?name=Putin');

            expect(res.statusCode).toBe(502);
            // All retry attempts were exhausted (first try + retries)
            expect(mockAxiosGet.mock.calls.length).toBeGreaterThanOrEqual(3);
        });

        it('should configure exponential backoff delay', () => {
            // Verify that retry configuration includes exponential delay
            const retryConfig = getLastRetryConfig();
            expect(retryConfig.retries).toBeGreaterThanOrEqual(3);
            expect(retryConfig.retryDelay).toBeDefined();
        });
    });

    // ========================================
    // 4. PARAMETER PASSING TESTS
    // ========================================

    describe('Parameter Passing - Query Parameter Forwarding to Yente', () => {

        it('should pass name parameter to Yente', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockAxiosGet.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Vladimir%20Putin');

            // Verify Yente was called with correct parameter
            expect(mockAxiosGet).toHaveBeenCalledWith(
                '/search/default',
                expect.objectContaining({
                    params: expect.objectContaining({
                        q: 'Vladimir Putin'
                    })
                })
            );
        });

        it('should pass limit parameter (custom value)', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockAxiosGet.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&limit=50');

            expect(mockAxiosGet).toHaveBeenCalledWith(
                '/search/default',
                expect.objectContaining({
                    params: expect.objectContaining({
                        limit: 50
                    })
                })
            );
        });

        it('should use default limit when not provided', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockAxiosGet.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin');

            expect(mockAxiosGet).toHaveBeenCalledWith(
                '/search/default',
                expect.objectContaining({
                    params: expect.objectContaining({
                        limit: 15 // Default value
                    })
                })
            );
        });

        it('should pass fuzzy parameter as boolean true', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockAxiosGet.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&fuzzy=true');

            expect(mockAxiosGet).toHaveBeenCalledWith(
                '/search/default',
                expect.objectContaining({
                    params: expect.objectContaining({
                        fuzzy: true // Converted from string 'true' to boolean
                    })
                })
            );
        });

        it('should pass fuzzy parameter as boolean false', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockAxiosGet.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&fuzzy=false');

            expect(mockAxiosGet).toHaveBeenCalledWith(
                '/search/default',
                expect.objectContaining({
                    params: expect.objectContaining({
                        fuzzy: false
                    })
                })
            );
        });

        it('should pass country parameter as countries in Yente URL', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockAxiosGet.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&country=RU');

            expect(mockAxiosGet).toHaveBeenCalledWith(
                '/search/default',
                expect.objectContaining({
                    params: expect.objectContaining({
                        countries: 'RU' // Note: Yente expects 'countries' not 'country'
                    })
                })
            );
        });

        it('should pass schema parameter without modification', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockAxiosGet.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin&schema=Person');

            expect(mockAxiosGet).toHaveBeenCalledWith(
                '/search/default',
                expect.objectContaining({
                    params: expect.objectContaining({
                        schema: 'Person'
                    })
                })
            );
        });

        it('should not include optional parameters when not provided', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockAxiosGet.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=Putin');

            const callArgs = mockAxiosGet.mock.calls[0][1];
            expect(callArgs.params).toHaveProperty('q');
            expect(callArgs.params).toHaveProperty('limit');
            expect(callArgs.params).toHaveProperty('fuzzy');
            // Optional params should not be included if not provided
            expect(callArgs.params.countries).toBeUndefined();
            expect(callArgs.params.schema).toBeUndefined();
        });

        it('should combine multiple parameters correctly', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockAxiosGet.mockResolvedValue(successResponse);

            await request(app)
                .get('/check?name=John%20Doe&limit=25&fuzzy=true&country=US&schema=Person');

            expect(mockAxiosGet).toHaveBeenCalledWith(
                '/search/default',
                expect.objectContaining({
                    params: expect.objectContaining({
                        q: 'John Doe',
                        limit: 25,
                        fuzzy: true,
                        countries: 'US',
                        schema: 'Person'
                    })
                })
            );
        });
    });

    // ========================================
    // 5. RESPONSE STRUCTURE TESTS
    // ========================================

    describe('Response Structure - Adapter Response Format', () => {

        it('should include request tracking ID in response', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockAxiosGet.mockResolvedValue(successResponse);

            const res = await request(app)
                .get('/check?name=Putin')
                .set('x-request-id', 'custom-req-id');

            expect(res.body.meta).toBeDefined();
            expect(res.body.meta.requestId).toBe('custom-req-id');
        });

        it('should auto-generate request ID if not provided', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockAxiosGet.mockResolvedValue(successResponse);

            const res = await request(app)
                .get('/check?name=Putin');

            expect(res.body.meta.requestId).toBeDefined();
            expect(res.body.meta.requestId).toMatch(/^req-/); // Auto-generated format
        });

        it('should include metadata with timestamp and source', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockAxiosGet.mockResolvedValue(successResponse);

            const res = await request(app)
                .get('/check?name=Putin');

            expect(res.body.meta.timestamp).toBeDefined();
            expect(res.body.meta.source).toBe('OpenSanctions (Local Yente)');
            expect(new Date(res.body.meta.timestamp).getTime()).toBeGreaterThan(0);
        });

        it('should include search parameters used in response', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockAxiosGet.mockResolvedValue(successResponse);

            const res = await request(app)
                .get('/check?name=Putin&limit=20&fuzzy=true&country=RU&schema=Person');

            expect(res.body.search_params).toEqual({
                limit: 20,
                fuzzy: true,
                schema: 'Person' // Note: schema is included when provided
            });
        });

        it('should include original query string', async () => {
            const successResponse = {
                data: { results: [] }
            };

            mockAxiosGet.mockResolvedValue(successResponse);

            const res = await request(app)
                .get('/check?name=Vladimir%20Putin&limit=10');

            expect(res.body.query).toBe('Vladimir Putin');
        });
    });

    // ========================================
    // 6. HEALTH CHECK ENDPOINT TESTS
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
