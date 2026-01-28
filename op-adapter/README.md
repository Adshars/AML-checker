OP-Adapter
==========

Lightweight HTTP adapter over the local OpenSanctions (Yente) API. Exposes a single entry point to check sanctions/PEP status for persons and entities, maps Yente responses to a simplified format, and provides health-check endpoint. Acts as a sanctions database query layer for the Core Service.

Stack and Dependencies
- Node.js 18, Express 5.2.1, ES Modules
- axios (^1.13.2) – HTTP client for Yente communication
- axios-retry (^4.0.0) – automatic retry mechanism with exponential backoff for Yente API calls
- winston (^3.19.0) + winston-daily-rotate-file (^5.0.0) – structured logging with daily file rotation (3-day retention, 20MB max size)
- jest (^30.2.0) + supertest (^7.2.2) – dev dependencies for integration testing
- cross-env (^10.1.0) – dev dependency for cross-platform environment variables
- Default service port: 3000 (mapped to 3001 in docker-compose via PORT_OP_ADAPTER variable)

Environment and Configuration
- `YENTE_API_URL` (optional) – base URL of Yente API; defaults to `http://localhost:8000`.
- In docker-compose: set to `http://yente:${YENTE_PORT}` to communicate with Yente container.
- `NODE_ENV` (optional) – application environment ('development', 'production', 'test'); affects error details in responses and logging behavior.
- No database, authentication, or additional secrets required.
- Application port: 3000 (hardcoded in src/index.js).
- Logging: Winston with daily file rotation – logs stored in `logs/` directory (app logs and error logs separate), 3-day retention, 20MB max file size.

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
---------

### Service Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/health` | ❌ No | Returns service status and mode |

### Sanctions Verification Endpoints

| Method | Endpoint | Auth Required | Description | Query Parameters | Optional Headers |
|--------|----------|---------------|-------------|------------------|------------------|
| GET | `/check` | ❌ No | Check entity against sanctions/PEP lists; delegates to Yente API with retry | `name` (required)<br>`limit` (optional, default: 15, range: 1-100)<br>`fuzzy` (optional, default: false)<br>`schema` (optional)<br>`country` (optional) | `x-request-id` (request tracking) |

### Endpoint Details

#### `/health` - Health Check
**Purpose:** Service health verification and status monitoring.

**Response:**
```json
{ 
  "status": "UP", 
  "service": "op-adapter", 
  "mode": "ES Modules + Retry" 
}
```

---

#### `/check` - Sanctions Check
**Purpose:** Query OpenSanctions data via Yente API; map results to simplified format; return entity sanctions/PEP status.

**Query Parameters:**
- `name` (required) - Person or entity name to check; trimmed before processing; returns 400 if missing/empty
- `limit` (optional, default: 15, range: 1-100) - Maximum results returned; automatically clamped to valid range:
  - Negative values or 0 → 1
  - Values > 100 → 100
  - Invalid/non-numeric → 15 (default)
- `fuzzy` (optional, default: false) - Enable fuzzy search for typos and variations; accepts:
  - Boolean: `true`/`false`
  - String: `"true"`/`"false"` (case-insensitive)
  - Other values → `false`
- `schema` (optional) - Filter by entity type (e.g., `Person`, `Company`, `Organization`); if omitted, searches all types
- `country` (optional) - Filter by country code (e.g., `US`, `GB`, `RU`); if omitted, searches all countries

**Optional Headers:**
- `x-request-id` - Request tracking ID; if absent, auto-generated in format `req-{timestamp}-{random7chars}`; returned in response `meta.requestId`

**Yente API Delegation:**
- Forwards to: `GET /search/default?q={name}&limit={limit}&fuzzy={fuzzy}&schema={schema}&countries={country}`
- Retry mechanism: 3 attempts with exponential backoff (1s → 2s → 4s)
- Timeout per request: 5000ms
- Retries on: network errors, 5xx server errors
- No retry on: 4xx client errors (invalid request)

**Response Structure:**
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
    "schema": null,
    "country": null
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
      "notes": ["U.S. OFAC Sanctions List"],
      "alias": ["J. Doe", "John D."],
      "address": ["123 Main St, New York, NY"],
      "datasets": ["ofac-sdn", "eu-consolidated"]
    }
  ]
}
```

**Response Fields (per entity):**
- `id` - Entity identifier from Yente
- `name` - Entity name (mapped from Yente `caption`)
- `schema` - Entity type: `Person`, `Company`, `Organization`, etc.
- `isSanctioned` - Boolean flag; `true` if entity on sanctions list (OFAC/UN/EU/etc.)
- `isPep` - Boolean flag; `true` if Politically Exposed Person
- `score` - Relevance/match score (0.0-1.0)
- `birthDate` - Birth date (first value from Yente or null)
- `birthPlace` - Birth place (first value from Yente or null)
- `gender` - Gender (first value from Yente or null)
- `nationality` - Array of nationality codes
- `country` - Array of country codes
- `position` - Array of position/role strings
- `notes` - Array of note/description strings
- `alias` - Array of alternate names
- `address` - Array of address strings
- `datasets` - Array of dataset identifiers (e.g., `ofac-sdn`, `eu-consolidated`)

**Sanctioning Flags (derived from Yente `properties.topics`):**
- `isSanctioned: true` - Entity found in `topics` array with `"sanction"` value
- `isPep: true` - Entity found in `topics` array with `"role.pep"` value

**Error Responses:**
- **400 Bad Request** - Missing or empty `name` parameter
  ```json
  { "error": "Missing name parameter" }
  ```

- **502 Bad Gateway** - Yente unavailable after 3 retry attempts
  ```json
  {
    "error": "Sanctions Service Unavailable",
    "details": "connect ECONNREFUSED 127.0.0.1:8000"
  }
  ```
  Note: `details` field only present in development mode (`NODE_ENV=development`)

- **500 Internal Server Error** - Unexpected error during processing
  ```json
  { "error": "Internal Server Error" }
  ```

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
			"notes": ["U.S. OFAC Sanctions List"],
			"alias": ["J. Doe", "John D."],
			"address": ["123 Main St, New York, NY"],
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
			"notes": ["PEP - UK Government Official"],
			"alias": [],
			"address": ["10 Downing St, London"],
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
- **Request Flow**: Client (Core Service) sends `GET /check?name=<entity>` with optional parameters (`limit`, `fuzzy`, `schema`, `country`) and optionally `x-request-id` header → OP-Adapter validates and trims `name` parameter → clamps `limit` to 1-100 range → converts `fuzzy` string to boolean → forwards to Yente API at `/search/default` with processed parameters.
- **Parameter Validation & Normalization**: 
	- `name`: required, trimmed; returns 400 if missing or empty.
	- `limit`: parsed as integer, clamped to range [1, 100]; defaults to 15 if not provided or invalid.
	- `fuzzy`: converted from string 'true'/'false' to boolean using `toBoolean()` helper; defaults to false.
	- `schema`, `country`: optional strings, trimmed before use.
- **Configurable Search**: `limit` parameter controls result count (default 15, max 100), `fuzzy` enables fuzzy matching for typos (default false), `schema` filters by entity type, and `country` filters by country code. All optional parameters can be combined.
- **Retry Mechanism**: OP-Adapter uses axios-retry with automatic retry on network errors and 5xx server errors (max 3 attempts, exponential backoff: 1s → 2s → 4s). Does NOT retry on 4xx errors (invalid request). Logs retry attempts with request details. Timeout per request: 5000ms.
- **Response Mapping**: For each Yente result, OP-Adapter extracts: `id`, `caption` (mapped to `name`), `schema` (Person/Company/Organization), and checks `properties.topics` array for sanctioning flags. Extended field mapping includes personal details (birthDate, birthPlace, gender, nationality), localization (country, position), and related data (notes, alias, address, datasets). Uses `SanctionEntity.fromYenteResponse()` DTO for transformation.
- **Sanctioning Flags**: 
	- `isSanctioned`: true if `topics` array contains `'sanction'` (indicating entity is on any OFAC/UN/EU/other sanctions list).
	- `isPep`: true if `topics` array contains `'role.pep'` (Politically Exposed Person status).
- **Simplified Response**: OP-Adapter returns mapped entities plus metadata (source, timestamp, requestId), the executed search parameters (after normalization), and hit count for easier downstream consumption and parameter tracking.
- **Request Tracking**: If `x-request-id` header is provided, it is preserved and returned in response `meta.requestId` for end-to-end request tracking. If missing, OP-Adapter generates one automatically in format `req-{timestamp}-{random7chars}`.
- **Error Handling**: 
	- Missing name → 400 Bad Request (logged as warning).
	- Yente unavailable/error (after retries) → 502 Bad Gateway with UpstreamError details (full message in development mode, generic in production).
	- Unexpected errors → 500 Internal Server Error (logged as error).
- **Logging**: All requests logged with INFO level (requestId, name, parameters). Errors logged with ERROR level. Warnings for missing parameters. Console output colorized, file output rotated daily.

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
- Yente `properties.notes` → OP-Adapter `notes` (array of note strings)
- Yente `properties.alias` → OP-Adapter `alias` (array of alternate names)
- Yente `properties.address` → OP-Adapter `address` (array of address strings)
- Yente `datasets` → OP-Adapter `datasets` (array of dataset identifiers)
- Yente `score` → OP-Adapter `score` (relevance/match score 0.0-1.0)

Limitations and TODO

Testing
-------

Integration tests for OP-Adapter verify endpoint behavior, data mapping, error handling, retry logic, and parameter forwarding to Yente. Tests use Jest test framework with Supertest for HTTP testing and mock axios/axios-retry to simulate various Yente responses and failure scenarios.

Test Files
- `tests/adapter.test.js` – comprehensive integration tests (35 tests total) for the `/check` endpoint and `/health` health check.
	- **Data Mapping (DTO Tests)** (4 tests):
		- Tests verify correct mapping of Yente response fields to simplified OP-Adapter format.
		- Validates extraction of sanctioning flags (`isSanctioned`, `isPep`) from `topics` array.
		- Handles sparse responses (missing optional fields, defaulting to null or empty arrays).
		- Extracts first value from multi-valued properties (e.g., `birthDate`, `birthPlace`, `gender`).
		- Array properties (nationality, country, position, notes, alias, address) returned as-is.
		- Returns empty data array when Yente finds no results.
	- **Error Handling (Yente Failures)** (5 tests):
		- Tests simulate Yente returning 500, 503, and other 5xx errors → verifies OP-Adapter returns 502 Bad Gateway.
		- Tests simulate network errors (timeout, connection refused) → verifies OP-Adapter returns 502 instead of crashing.
		- Tests simulate malformed Yente response (missing expected fields) → verifies graceful 502 error.
		- Tests validate missing `name` parameter returns 400 Bad Request before calling Yente.
	- **Limit Validation & Edge Cases** (6 tests):
		- Tests verify limit clamping to valid range: negative values and 0 clamped to 1.
		- Tests verify limit exceeding MAX_LIMIT (100) clamped to 100.
		- Tests validate boundary values: limit=1 and limit=100 accepted as-is.
		- Tests ensure extremely large limits (e.g., 1000) are capped at MAX_LIMIT.
	- **Boolean Conversion (toBoolean Helper)** (4 tests):
		- Tests verify string "true" converts to boolean true, "false" to boolean false.
		- Tests verify non-"true" string values (e.g., "yes", empty string) default to false.
		- Tests ensure robust handling of edge cases in fuzzy parameter conversion.
	- **Parameter Passing (Forwarding to Yente)** (9 tests):
		- Tests verify `name` parameter is correctly passed to Yente as `q` query parameter.
		- Tests verify `limit` parameter is passed as-is (with default 15 if omitted).
		- Tests verify `fuzzy` parameter converts string 'true'/'false' to boolean.
		- Tests verify `country` parameter is mapped to `countries` in Yente URL.
		- Tests verify `schema` parameter is passed without modification.
		- Tests verify optional parameters are omitted from request if not provided.
		- Tests verify multiple parameters can be combined correctly.
	- **Response Structure Tests** (5 tests):
		- Tests verify response includes request tracking ID (from header or auto-generated).
		- Tests verify metadata includes timestamp and source attribution.
		- Tests verify search parameters are echoed back in response.
		- Tests verify original query string is included in response.
	- **Health Check Tests** (2 tests):
		- Tests verify `/health` endpoint returns UP status without requiring authentication.
	- Mocks: YenteClient (search method), logger (debug, info, warn, error).

Running Tests
- Command: `npm test` (runs all tests with verbose output)
- Uses Jest with ES Modules support (`cross-env NODE_OPTIONS=--experimental-vm-modules jest --verbose`)
- Tests run in isolated environment with mocked dependencies (no real Yente connection required)
- All mocks are defined before importing application code using `jest.unstable_mockModule`

Test Coverage
- **Data Transformation** (4 tests): Tests verify correct field extraction, mapping of `topics` to flags, handling of multi-valued properties, and null/empty defaults.
- **Failure Scenarios** (5 tests): Tests ensure proper error handling for Yente server errors, network failures, timeouts, and malformed responses.
- **Input Validation** (6 tests): Tests verify limit parameter clamping (negative, zero, exceeding MAX_LIMIT=100) and boundary values (1, 100).
- **Type Conversion** (4 tests): Tests verify toBoolean helper correctly converts string "true"/"false" to boolean and handles edge cases (non-true values, empty strings).
- **API Contract** (9 tests): Tests ensure all query parameters are correctly forwarded to Yente with proper transformations (e.g., country → countries, fuzzy string → boolean).
- **Response Contract** (5 tests): Tests verify response structure includes metadata, search parameters, hit count, and mapped data array.
- **Health Endpoint** (2 tests): Tests verify health check returns UP status without authentication.

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
			✓ should return 502 when Yente throws upstream error
			✓ should return 502 when Yente is unreachable (network error)
			✓ should tolerate missing results and return empty array
			✓ should return 400 when name parameter is missing
			✓ should return 502 when Yente returns 503 Service Unavailable
		Limit Validation - Edge Cases and Boundary Testing
			✓ should clamp negative limit to 1
			✓ should clamp limit of 0 to 1
			✓ should clamp limit exceeding MAX_LIMIT (100) to 100
			✓ should clamp extremely large limit (1000) to 100
			✓ should accept valid limit at boundary (1)
			✓ should accept valid limit at upper boundary (100)
		Boolean Conversion - toBoolean Helper Edge Cases
			✓ should convert string "true" to boolean true
			✓ should convert string "false" to boolean false
			✓ should treat non-true string values as false
			✓ should treat empty fuzzy parameter as false
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
Tests:       35 passed, 35 total
Time:        2.61 s
```

Project Structure
```
op-adapter/
├── src/
│   ├── index.js                    # Entry point (starts Express server on port 3000)
│   ├── app.js                      # Express app factory (dependency injection)
│   ├── clients/
│   │   └── YenteClient.js          # Yente API HTTP client (axios + retry)
│   ├── controllers/
│   │   └── SanctionsController.js  # Request handlers (/health, /check)
│   ├── models/
│   │   └── SanctionEntity.dto.js   # DTO for Yente→OP-Adapter response mapping
│   ├── services/
│   │   └── SanctionsService.js     # Business logic (entity search, UpstreamError)
│   └── utils/
│       └── logger.js               # Winston logger with daily rotation
├── tests/
│   └── adapter.test.js             # Integration tests (35 tests)
├── logs/                           # Log files (auto-created, .gitignore)
├── package.json
├── Dockerfile
└── README.md
```

Limitations and TODO
- **No authentication or rate limiting** – OP-Adapter assumes it's called only from Core Service (behind API Gateway auth); direct access is unrestricted.
- **Retry strategy**: Retries up to 3 times on network errors and 5xx responses with exponential backoff (1s, 2s, 4s), but does not retry on client errors (4xx); could add configurable retry count and delay strategy.
- **No response caching** – every check hits Yente directly (even with retries); consider Redis cache for frequently checked names to reduce latency and retry overhead.
- **Error details conditionally exposed** – 502 response includes error message only in development mode; production returns generic message for security.
- **Score interpretation not documented** – score field returned from Yente but meaning varies; could add clarification or threshold logic.
- **No support for multiple names** – only single name-based search; cannot check multiple entities in one request.
- **Yente service dependency** – if Yente is down, OP-Adapter will retry 3 times then fail; no fallback or degraded mode.
- **Log retention hardcoded** – 3-day retention and 20MB max file size configured in logger.js; not exposed via environment variables.