OP-Adapter
==========

Lightweight HTTP adapter over the local OpenSanctions (Yente) API. Exposes a single entry point to check sanctions/PEP status for persons and entities, maps Yente responses to a simplified format, and provides health-check endpoint. Acts as a sanctions database query layer for the Core Service.

Stack and Dependencies
- Node.js 18, Express 5.2.1, ES Modules
- axios (^1.13.2) – HTTP client for Yente communication
- axios-retry (^4.0.0) – automatic retry mechanism with exponential backoff for Yente API calls
- winston + winston-daily-rotate-file (^5.0.0) – structured logging with file rotation
- jest + supertest (dev dependencies for integration testing)
- cross-env (dev dependency for cross-platform environment variables)
- Default service port: 3000 (mapped to 3001 in docker-compose via PORT_OP_ADAPTER variable)

Environment and Configuration
- `YENTE_API_URL` (optional) – base URL of Yente API; defaults to `http://localhost:8000`.
- In docker-compose: set to `http://yente:${YENTE_PORT}` to communicate with Yente container.
- No database, authentication, or additional secrets required.
- Application port: 3000 (hardcoded in code).

Local Run
1) `npm install`
2) Ensure Yente API is running on `http://localhost:8000` (or set `YENTE_API_URL` to correct address)
3) `npm start` – starts OP-Adapter on http://localhost:3000

4) `npm test` (for running integration tests)

Docker Compose Run
- From project root: `docker compose up --build op-adapter yente`
- Endpoints available at http://localhost:3001 (mapped from container 3000).
- Automatically connects to Yente container at `http://yente:${YENTE_PORT}`.

Endpoints
- `GET /health` – health check endpoint; returns service status and mode.
	- Query parameters: none.
	- No authentication required.
	- Returns: `{ status: "UP", service: "op-adapter", mode: "ES Modules + Retry" }`.
- `GET /check` – main sanctions verification endpoint (used by Core Service).
	- Query parameters:
		- `name` (required) – person or entity name to check against sanctions/PEP lists.
		- `limit` (optional, default: 15) – maximum number of results returned; configurable per request.
		- `fuzzy` (optional, default: 'false') – enable fuzzy search to handle typos and variations; values: 'true' or 'false'.
		- `schema` (optional) – filter by entity type (e.g., 'Person', 'Company', 'Organization'); if omitted, searches all types.
		- `country` (optional) – filter by country code (e.g., 'US', 'GB'); if omitted, searches all countries.
	- Optional header: `x-request-id` (request tracking ID; auto-generated if missing and returned in response).
	- No authentication required; called from Core Service which enforces organization context.
	- Delegates to Yente API: `GET /search/default?q=<name>&limit=<limit>&fuzzy=<fuzzy>&schema=<schema>&countries=<country>` with automatic retry (3 attempts, exponential backoff).
	- Returns: simplified response with query metadata, hit count, request ID, search parameters used, and mapped result array.
	- Response fields per result: `id`, `name`, `schema`, `isSanctioned`, `isPep`, `score`, `birthDate`, `birthPlace`, `gender`, `nationality`, `country`, `position`, `description`, `aliases`, `addresses`, `datasets`.
	- Error responses: 400 (missing name parameter), 502 (Yente unavailable or malformed response after retries).

Usage Examples
- Health:
```bash
curl http://localhost:3001/health
```

- Person check:
```bash
curl "http://localhost:3001/check?name=John%20Doe"
```

- Person check with custom limit and fuzzy search:
```bash
curl "http://localhost:3001/check?name=John%20Doe&limit=20&fuzzy=true"
```

- Check with schema filtering (Person only):
```bash
curl "http://localhost:3001/check?name=John%20Doe&schema=Person"
```

- Check with country filtering (US only):
```bash
curl "http://localhost:3001/check?name=John%20Doe&country=US"
```

- Check with multiple filters (Person, US, 25 results, fuzzy):
```bash
curl "http://localhost:3001/check?name=John%20Doe&schema=Person&country=US&limit=25&fuzzy=true"
```

Response Structure
- `/health`:
```json
{ "status": "UP", "service": "op-adapter", "mode": "ES Modules + Retry" }
```

- `/check` (success example):
```json
{
	"meta": {
		"source": "OpenSanctions (Local Yente)",
		"timestamp": "2025-12-28T10:30:45.123Z",
		"requestId": "req-1735386645123-a1b2c3d4"
	},
	"query": "John Doe",
	"search_params": {
		"limit": 15,
		"fuzzy": false,
		"schema": null
	},
	"hits_count": 2,
	"data": [
		{
			"id": "ocbid-8f7ac0e8b79e67a42c6de10d8a2c7b3f",
			"name": "John Doe",
			"schema": "Person",
			"isSanctioned": true,
			"isPep": false,
			"score": 0.98,
			"birthDate": "1970-01-01",
			"birthPlace": "New York",
			"gender": "M",
			"nationality": ["US"],
			"country": ["US"],
			"position": ["OFAC Officer"],
			"description": ["U.S. OFAC Sanctions List"],
			"aliases": ["J. Doe", "John D."],
			"addresses": ["123 Main St, New York, NY"],
			"datasets": ["ofac-sdn", "eu-consolidated"]
		},
		{
			"id": "ocbid-7e6ab1d7a68e56b41b5cd9c7a1b6a2e",
			"name": "John Michael Doe",
			"schema": "Person",
			"isSanctioned": false,
			"isPep": true,
			"score": 0.85,
			"birthDate": "1975-06-15",
			"birthPlace": "London",
			"gender": "M",
			"nationality": ["GB"],
			"country": ["GB"],
			"position": ["Government Official"],
			"description": ["PEP - UK Government Official"],
			"aliases": [],
			"addresses": ["10 Downing St, London"],
			"datasets": ["pep-gb"]
		}
	]
}
```

- `/check` (no hits example):
```json
{
	"meta": {
		"source": "OpenSanctions (Local Yente)",
		"timestamp": "2025-12-28T10:30:45.123Z",
		"requestId": "req-1735386645123-a1b2c3d4"
	},
	"query": "Jane Smith",
	"search_params": {
		"limit": 15,
		"fuzzy": false,
		"schema": null
	},
	"hits_count": 0,
	"data": []
}
```

- `/check` (error example - Yente unavailable):
```json
{
	"error": "Sanctions Service Unavailable",
	"details": "connect ECONNREFUSED 127.0.0.1:8000"
}
```

How It Works (High Level)
- **Request Flow**: Client (Core Service) sends `GET /check?name=<entity>` with optional parameters (`limit`, `fuzzy`, `schema`, `country`) and optionally `x-request-id` header → OP-Adapter validates `name` parameter → forwards to Yente API at `/search/default` with query name and optional filters.
- **Configurable Search**: `limit` parameter controls result count (default 15), `fuzzy` enables fuzzy matching for typos (default false), `schema` filters by entity type, and `country` filters by country code. All parameters are optional and can be combined.
- **Retry Mechanism**: OP-Adapter uses axios-retry with automatic retry on network errors and 5xx server errors (max 3 attempts, exponential backoff: 1s → 2s → 4s). Does NOT retry on 4xx errors (invalid request). Logs retry attempts with request details.
- **Response Mapping**: For each Yente result, OP-Adapter extracts: `id`, `caption` (mapped to `name`), `schema` (Person/Company/Organization), and checks `properties.topics` array for sanctioning flags. Extended field mapping includes personal details (birthDate, birthPlace, gender, nationality), localization (country, position), and related data (aliases, addresses, datasets).
- **Sanctioning Flags**: 
	- `isSanctioned`: true if `topics` array contains `'sanction'` (indicating entity is on any OFAC/UN/EU/other sanctions list).
	- `isPep`: true if `topics` array contains `'role.pep'` (Politically Exposed Person status).
- **Simplified Response**: OP-Adapter returns relevant fields plus metadata (source, timestamp, requestId), the executed search parameters, and hit count for easier downstream consumption and parameter tracking.
- **Request Tracking**: If `x-request-id` header is provided, it is preserved and returned in response `meta.requestId` for end-to-end request tracking. If missing, OP-Adapter generates one automatically.
- **Error Handling**: If Yente is unavailable (after all retries) or returns malformed data, OP-Adapter returns 502 error with error message and details.

Yente API Field Mapping
- Yente `id` → OP-Adapter `id`
- Yente `caption` → OP-Adapter `name`
- Yente `schema` → OP-Adapter `schema` (Person, Company, Organization, etc.)
- Yente `properties.topics` → OP-Adapter `isSanctioned`, `isPep` flags
- Yente `properties.birthDate` → OP-Adapter `birthDate` (first value or null)
- Yente `properties.birthPlace` → OP-Adapter `birthPlace` (first value or null)
- Yente `properties.gender` → OP-Adapter `gender` (first value or null)
- Yente `properties.nationality` → OP-Adapter `nationality` (array of nationality codes)
- Yente `properties.country` → OP-Adapter `country` (array of country codes)
- Yente `properties.position` → OP-Adapter `position` (array of position strings)
- Yente `properties.notes` → OP-Adapter `description` (array of note strings)
- Yente `properties.alias` → OP-Adapter `aliases` (array of alternate names)
- Yente `properties.address` → OP-Adapter `addresses` (array of address strings)
- Yente `datasets` → OP-Adapter `datasets` (array of dataset identifiers)
- Yente `score` → OP-Adapter `score` (relevance/match score 0.0-1.0)

Limitations and TODO

Testing
-------

Integration tests for OP-Adapter verify endpoint behavior, data mapping, error handling, retry logic, and parameter forwarding to Yente. Tests use Jest test framework with Supertest for HTTP testing and mock axios/axios-retry to simulate various Yente responses and failure scenarios.

Test Files
- `tests/adapter.test.js` – comprehensive integration tests for the `/check` endpoint and `/health` health check.
	- **Data Mapping (DTO Tests)**:
		- Tests verify correct mapping of Yente response fields to simplified OP-Adapter format.
		- Validates extraction of sanctioning flags (`isSanctioned`, `isPep`) from `topics` array.
		- Handles sparse responses (missing optional fields, defaulting to null or empty arrays).
		- Extracts first value from multi-valued properties (e.g., `birthDate`, `birthPlace`).
		- Returns empty data array when Yente finds no results.
	- **Error Handling (Yente Failures)**:
		- Tests simulate Yente returning 500, 503, and other 5xx errors → verifies OP-Adapter returns 502 Bad Gateway.
		- Tests simulate network errors (timeout, connection refused) → verifies OP-Adapter returns 502 instead of crashing.
		- Tests simulate malformed Yente response (missing expected fields) → verifies graceful 502 error.
		- Tests validate missing `name` parameter returns 400 Bad Request before calling Yente.
	- **Retry Logic (Resilience)**:
		- Tests verify retry mechanism: simulates 1st call failure, 2nd call success → verifies request eventually succeeds.
		- Tests verify retry condition: 4xx errors do NOT trigger retry (safe to skip), 5xx errors DO trigger retry.
		- Tests verify exponential backoff configuration (3 retries max, increasing delay).
		- Tests verify exhausted retries: all 3 attempts fail → verifies final 502 response.
	- **Parameter Passing (Forwarding to Yente)**:
		- Tests verify `name` parameter is correctly passed to Yente as `q` query parameter.
		- Tests verify `limit` parameter is passed as-is (with default 15 if omitted).
		- Tests verify `fuzzy` parameter converts string 'true'/'false' to boolean.
		- Tests verify `country` parameter is mapped to `countries` in Yente URL.
		- Tests verify `schema` parameter is passed without modification.
		- Tests verify optional parameters are omitted from request if not provided.
		- Tests verify multiple parameters can be combined correctly.
	- **Response Structure Tests**:
		- Tests verify response includes request tracking ID (from header or auto-generated).
		- Tests verify metadata includes timestamp and source attribution.
		- Tests verify search parameters are echoed back in response.
		- Tests verify original query string is included in response.
	- **Health Check Tests**:
		- Tests verify `/health` endpoint returns UP status without requiring authentication.
	- Mocks: axios (HTTP client with controlled Yente responses), axios-retry (retry configuration), logger.

Running Tests
- Command: `npm test` (runs all tests with verbose output)
- Uses Jest with ES Modules support (`cross-env NODE_OPTIONS=--experimental-vm-modules jest --verbose`)
- Tests run in isolated environment with mocked dependencies (no real Yente connection required)
- All mocks are defined before importing application code using `jest.unstable_mockModule`

Test Coverage
- **Data Transformation**: Tests verify correct field extraction, mapping of `topics` to flags, handling of multi-valued properties, and null/empty defaults.
- **Failure Scenarios**: Tests ensure proper error handling for Yente server errors, network failures, timeouts, and malformed responses.
- **Resilience**: Tests verify retry mechanism with exponential backoff, retry conditions, and exhaustion handling.
- **API Contract**: Tests ensure all query parameters are correctly forwarded to Yente with proper transformations (e.g., country → countries, fuzzy string → boolean).
- **Response Contract**: Tests verify response structure includes metadata, search parameters, hit count, and mapped data array.

Example Test Execution
```bash
npm test
```

Expected output:
```
PASS  tests/adapter.test.js
	OP-Adapter Integration Tests
		Data Mapping (DTO) - Yente Response Transformation
			✓ should correctly map Yente response with all fields populated
			✓ should handle sparse Yente response (missing optional fields)
			✓ should extract first value from multi-valued properties
			✓ should return empty data array when Yente finds no results
		Error Handling - Yente API Failures
			✓ should return 502 when Yente returns 500 after retries
			✓ should return 502 when Yente is unreachable (network error)
			✓ should return 502 when Yente returns malformed response
			✓ should return 400 when name parameter is missing
			✓ should return 502 when Yente returns 503 Service Unavailable
		Retry Logic - Exponential Backoff and Recovery
			✓ should succeed on retry after initial failure
			✓ should retry on network errors but not on 4xx errors
			✓ should retry on 5xx errors
			✓ should eventually fail after max retries exhausted
			✓ should configure exponential backoff delay
		Parameter Passing - Query Parameter Forwarding to Yente
			✓ should pass name parameter to Yente
			✓ should pass limit parameter (custom value)
			✓ should use default limit when not provided
			✓ should pass fuzzy parameter as boolean true
			✓ should pass fuzzy parameter as boolean false
			✓ should pass country parameter as countries in Yente URL
			✓ should pass schema parameter without modification
			✓ should not include optional parameters when not provided
			✓ should combine multiple parameters correctly
		Response Structure - Adapter Response Format
			✓ should include request tracking ID in response
			✓ should auto-generate request ID if not provided
			✓ should include metadata with timestamp and source
			✓ should include search parameters used in response
			✓ should include original query string
		Health Check Endpoint
			✓ should return UP status
			✓ should not require authentication

Test Suites: 1 passed, 1 total
Tests:       32 passed, 32 total
```

Limitations and TODO
- **No authentication or rate limiting** – OP-Adapter assumes it's called only from Core Service (behind API Gateway auth); direct access is unrestricted.
- **Retry strategy**: Retries up to 3 times on network errors and 5xx responses with exponential backoff (1s, 2s, 4s), but does not retry on client errors (4xx); could add configurable retry count and delay strategy.
- **No response caching** – every check hits Yente directly (even with retries); consider Redis cache for frequently checked names to reduce latency and retry overhead.
- **Limited error details** – 502 response on Yente failure after retries; could provide more granular error information (retry count exhausted, timeout, malformed response, etc.).
- **Score interpretation not documented** – score field returned from Yente but meaning varies; could add clarification or threshold logic.
- **No support for multiple names** – only single name-based search; cannot check multiple entities in one request.
- **Yente service dependency** – if Yente is down, OP-Adapter will retry 3 times then fail; no fallback or degraded mode.