OP-Adapter
==========

Lightweight HTTP adapter over the local OpenSanctions (Yente) API. Exposes a single entry point to check sanctions/PEP status for persons and entities, maps Yente responses to a simplified format, and provides health-check endpoint. Acts as a sanctions database query layer for the Core Service.

**Version:** 1.0.0  
**Node.js:** 18+  
**Build Tool:** ES Modules

## Table of Contents

- [Stack and Dependencies](#stack-and-dependencies)
- [Environment and Configuration](#environment-and-configuration)
- [Local Setup](#local-setup)
- [Docker Compose Setup](#docker-compose-setup)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
  - [Health Check](#health-check)
  - [Sanctions Check](#sanctions-check)
  - [Response Formats](#response-formats)
  - [Error Handling](#error-handling)
- [Usage Examples](#usage-examples)
- [How It Works](#how-it-works)
  - [Request Flow](#request-flow)
  - [Parameter Validation](#parameter-validation)
  - [Retry Mechanism](#retry-mechanism)
  - [Response Mapping](#response-mapping)
  - [Sanctioning Flags](#sanctioning-flags)
  - [Request Tracking](#request-tracking)
  - [Error Handling Flow](#error-handling-flow)
  - [Logging](#logging)
- [Yente API Field Mapping](#yente-api-field-mapping)
- [Architecture](#architecture)
  - [YenteClient](#yenteclient)
  - [SanctionsService](#sanctionsservice)
  - [SanctionsController](#sanctionscontroller)
  - [SanctionEntity DTO](#sanctionentity-dto)
  - [Logger](#logger)
- [Testing](#testing)
  - [Test Coverage](#test-coverage)
  - [Running Tests](#running-tests)
  - [Example Output](#example-output)
- [Limitations and Future Work](#limitations-and-future-work)
- [License](#license)

---

## Stack and Dependencies

**Core Framework:**
- **Node.js** 18+ – JavaScript runtime
- **Express** 5.2.1 – Web framework
- **ES Modules** – Modern JavaScript modules

**HTTP Client:**
- **axios** 1.13.2 – HTTP client for Yente communication
- **axios-retry** 4.0.0 – Automatic retry with exponential backoff (3 attempts, 1s → 2s → 4s)

**Logging:**
- **winston** 3.19.0 – Structured logging
- **winston-daily-rotate-file** 5.0.0 – Daily file rotation (3-day retention, 20MB max size)

**Development & Testing:**
- **jest** 30.2.0 – Test framework
- **supertest** 7.2.2 – HTTP testing library
- **cross-env** 10.1.0 – Cross-platform environment variables

**Service Port:**
- Default: `3000`
- Docker: Mapped to `3001` via `PORT_OP_ADAPTER` variable

## Environment and Configuration

| Variable | Description | Default Value | Required |
|----------|-------------|---------------|----------|
| `YENTE_API_URL` | Base URL of Yente API | `http://localhost:8000` | ❌ No |
| `NODE_ENV` | Environment mode (development, production, test) | `development` | ❌ No |
| `PORT_OP_ADAPTER` | Service port (Docker only) | `3001` | ❌ No |

**Application Configuration:**
- Service port: `3000` (hardcoded in [src/index.js](src/index.js))
- Timeout per request: `5000ms`
- Retry attempts: `3` (with exponential backoff)
- Default limit: `15` (range: 1-100)
- Logging: Winston with daily rotation
  - Directory: `logs/`
  - App log: `app.log`
  - Error log: `error.log`
  - Retention: 3 days
  - Max size: 20MB per file

**No database, authentication, or additional secrets required.**

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Ensure Yente API is running:**
   ```bash
   # Yente should be available at http://localhost:8000
   # Or set YENTE_API_URL environment variable
   export YENTE_API_URL=http://localhost:8000
   ```

3. **Start OP-Adapter:**
   ```bash
   npm start
   ```
   Service available at `http://localhost:3000`

4. **Run tests:**
   ```bash
   npm test
   ```

## Docker Compose Setup

**From project root directory:**
```bash
docker compose up --build op-adapter yente
```

**Configuration:**
- Service accessible at `http://localhost:3001`
- Automatically connects to Yente at `http://yente:${YENTE_PORT}`
- Environment variables configured in docker-compose.yml

**Example docker-compose.yml snippet:**
```yaml
op-adapter:
  build: ./op-adapter
  ports:
    - "3001:3000"
  environment:
    - YENTE_API_URL=http://yente:8000
    - NODE_ENV=production
  depends_on:
    - yente
```

---

## Project Structure

```
op-adapter/
├── src/
│   ├── index.js                    # Entry point (starts Express server on port 3000)
│   ├── app.js                      # Express app factory with dependency injection
│   ├── clients/
│   │   └── YenteClient.js          # Yente API HTTP client (axios + retry)
│   ├── controllers/
│   │   └── SanctionsController.js  # Request handlers (/health, /check)
│   ├── models/
│   │   └── SanctionEntity.dto.js   # DTO for Yente → OP-Adapter response mapping
│   ├── services/
│   │   └── SanctionsService.js     # Business logic (entity search, UpstreamError)
│   └── utils/
│       └── logger.js               # Winston logger with daily file rotation
├── tests/
│   └── adapter.test.js             # Integration tests (35 tests)
├── logs/                           # Log files (auto-created, .gitignore)
├── Dockerfile                      # Multi-stage Docker build
├── package.json                    # Dependencies and scripts
└── README.md                       # This file
```

---

## API Endpoints

**Base URL:** `http://localhost:3000` (or configured port)

### Health Check

**Endpoint:** `GET /health`

**Auth Required:** ❌ No

**Purpose:** Service health verification and status monitoring.

**Response:** `200 OK`
```json
{
  "status": "UP",
  "service": "op-adapter",
  "mode": "ES Modules + Retry"
}
```

**Example:**
```bash
curl http://localhost:3000/health
```

### Sanctions Check

**Endpoint:** `GET /check`

**Auth Required:** ❌ No

**Purpose:** Query OpenSanctions data via Yente API; map results to simplified format; return entity sanctions/PEP status.

**Query Parameters:**

| Parameter | Type | Required | Default | Range | Description |
|-----------|------|----------|---------|-------|-------------|
| `name` | String | ✅ Yes | - | - | Person or entity name to check; trimmed before processing; returns 400 if missing/empty |
| `limit` | Integer | ❌ No | `15` | 1-100 | Maximum results returned; automatically clamped to valid range |
| `fuzzy` | Boolean/String | ❌ No | `false` | - | Enable fuzzy search for typos/variations; accepts `true`/`false` or string `"true"`/`"false"` |
| `schema` | String | ❌ No | - | - | Filter by entity type (e.g., `Person`, `Company`, `Organization`) |
| `country` | String | ❌ No | - | - | Filter by country code (e.g., `US`, `GB`, `RU`) |

**Optional Headers:**
- `x-request-id` – Request tracking ID; if absent, auto-generated in format `req-{timestamp}-{random7chars}`; returned in response `meta.requestId`

**Yente API Delegation:**
- Forwards to: `GET /search/default?q={name}&limit={limit}&fuzzy={fuzzy}&schema={schema}&countries={country}`
- Retry mechanism: 3 attempts with exponential backoff (1s → 2s → 4s)
- Timeout per request: 5000ms
- Retries on: network errors, 5xx server errors
- Does NOT retry on: 4xx client errors

### Response Formats

#### Success Response (Hit)

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

#### Success Response (No Hits)

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
    "schema": null,
    "country": null
  },
  "hits_count": 0,
  "data": []
}
```

**Response Fields (per entity):**
- `id` – Entity identifier from Yente
- `name` – Entity name (mapped from Yente `caption`)
- `schema` – Entity type: `Person`, `Company`, `Organization`, etc.
- `isSanctioned` – Boolean flag; `true` if entity on sanctions list (OFAC/UN/EU/etc.)
- `isPep` – Boolean flag; `true` if Politically Exposed Person
- `score` – Relevance/match score (0.0-1.0)
- `birthDate` – Birth date (first value from Yente or null)
- `birthPlace` – Birth place (first value from Yente or null)
- `gender` – Gender (first value from Yente or null)
- `nationality` – Array of nationality codes
- `country` – Array of country codes
- `position` – Array of position/role strings
- `notes` – Array of note/description strings
- `alias` – Array of alternate names
- `address` – Array of address strings
- `datasets` – Array of dataset identifiers (e.g., `ofac-sdn`, `eu-consolidated`)

### Error Handling

#### 400 Bad Request
**Cause:** Missing or empty `name` parameter

**Response:**
```json
{
  "error": "Missing name parameter"
}
```

#### 502 Bad Gateway
**Cause:** Yente unavailable after 3 retry attempts

**Response:**
```json
{
  "error": "Sanctions Service Unavailable",
  "details": "connect ECONNREFUSED 127.0.0.1:8000"
}
```

**Note:** `details` field only present in development mode (`NODE_ENV=development`)

#### 500 Internal Server Error
**Cause:** Unexpected error during processing

**Response:**
```json
{
  "error": "Internal Server Error"
}
```

---

## Usage Examples

### Health Check
```bash
curl http://localhost:3000/health
```

### Simple Sanctions Check
```bash
curl "http://localhost:3000/check?name=John%20Doe"
```

### Custom Limit and Fuzzy Search
```bash
curl "http://localhost:3000/check?name=John%20Doe&limit=20&fuzzy=true"
```

### Schema Filtering (Person Only)
```bash
curl "http://localhost:3000/check?name=John%20Doe&schema=Person"
```

### Country Filtering (US Only)
```bash
curl "http://localhost:3000/check?name=John%20Doe&country=US"
```

### Multiple Filters with Request Tracking
```bash
curl -H "x-request-id: my-custom-id" \
  "http://localhost:3000/check?name=John%20Doe&schema=Person&country=US&limit=25&fuzzy=true"
```

---

## How It Works

### Request Flow

1. Client (Core Service) sends `GET /check?name=<entity>` with optional parameters
2. OP-Adapter validates and trims `name` parameter
3. Clamps `limit` to 1-100 range
4. Converts `fuzzy` string to boolean
5. Forwards to Yente API at `/search/default` with processed parameters
6. Yente returns results with metadata
7. OP-Adapter maps each Yente result to simplified entity format
8. Returns response with metadata, query, search parameters, hit count, and data array

### Parameter Validation

**`name` parameter:**
- Required, trimmed before processing
- Returns 400 if missing or empty after trim

**`limit` parameter:**
- Parsed as integer
- Clamped to range [1, 100]
- Defaults to 15 if not provided or invalid
- Example: `-5` → `1`, `150` → `100`, `invalid` → `15`

**`fuzzy` parameter:**
- Converted from string 'true'/'false' to boolean using `toBoolean()` helper
- Defaults to `false` if not provided or invalid
- Handles string values case-insensitively

**`schema` parameter:**
- Optional string, trimmed before use
- No validation, passed as-is to Yente

**`country` parameter:**
- Optional string, trimmed before use
- Mapped to `countries` in Yente URL

### Retry Mechanism

OP-Adapter uses **axios-retry** with automatic retry on network errors and 5xx server errors:

| Aspect | Value |
|--------|-------|
| Max attempts | 3 |
| Backoff strategy | Exponential (1s → 2s → 4s) |
| Timeout per request | 5000ms |
| Retries on | Network errors, 5xx responses |
| Does NOT retry on | 4xx client errors |
| Logs retry attempts | Yes (with request details) |

**Example flow:** 
- Attempt 1 fails → wait 1s
- Attempt 2 fails → wait 2s
- Attempt 3 fails → return 502 Bad Gateway

### Response Mapping

For each Yente result, OP-Adapter extracts:

1. **Basic fields:**
   - `id` from Yente `id`
   - `name` from Yente `caption` (or first value of `properties.name`)
   - `schema` from Yente `schema`
   - `score` from Yente `score`

2. **Personal details:**
   - `birthDate` from first value of `properties.birthDate` (or null)
   - `birthPlace` from first value of `properties.birthPlace` (or null)
   - `gender` from first value of `properties.gender` (or null)

3. **Localization:**
   - `nationality` array from `properties.nationality`
   - `country` array from `properties.country`
   - `position` array from `properties.position`
   - `address` array from `properties.address`

4. **Related data:**
   - `notes` array from `properties.notes`
   - `alias` array from `properties.alias`
   - `datasets` array from Yente `datasets`

5. **Sanctioning flags:**
   - Checks `properties.topics` array for `"sanction"` and `"role.pep"` values

### Sanctioning Flags

**`isSanctioned: true`** 
- Entity found in `topics` array with `"sanction"` value
- Indicates entity is on OFAC/UN/EU or other sanctions list

**`isPep: true`**
- Entity found in `topics` array with `"role.pep"` value
- Indicates Politically Exposed Person status

### Request Tracking

**If `x-request-id` header provided:**
- Preserved through entire processing
- Returned in response `meta.requestId`
- Used for end-to-end request tracking

**If `x-request-id` header absent:**
- Auto-generated in format `req-{timestamp}-{random7chars}`
- Example: `req-1735386645123-a1b2c3d4`

### Error Handling Flow

1. **Missing name** → Log warning → Return 400 Bad Request
2. **Yente error after retries** → Log error → Return 502 Bad Gateway
3. **Unexpected error** → Log error → Return 500 Internal Server Error
4. **In development mode** → Include error `details`
5. **In production mode** → Return generic error message for security

### Logging

Winston logger with daily file rotation:

**Log Levels:**
- `INFO` – All requests with requestId, name, parameters
- `WARN` – Missing parameters
- `ERROR` – API failures and exceptions

**Log Files:**
- `logs/app.log` – Application logs (info, warn)
- `logs/error.log` – Error logs
- Rotation: Daily, 3-day retention, 20MB max size

**Example log entry:**
```
2025-12-28 10:30:45 [INFO] Received check request { requestId: 'req-1735386645123-a1b2c3d4', name: 'John Doe', limit: 15, fuzzy: false }
2025-12-28 10:30:45 [INFO] Yente search completed { requestId: 'req-1735386645123-a1b2c3d4', hits: 2, durationMs: 245 }
```

---

## Yente API Field Mapping

| Yente Field | OP-Adapter Field | Type | Notes |
|-------------|------------------|------|-------|
| `id` | `id` | String | Entity identifier |
| `caption` | `name` | String | Entity display name |
| `schema` | `schema` | String | Entity type (Person, Company, etc.) |
| `score` | `score` | Float | Match confidence (0.0-1.0) |
| `properties.topics` | `isSanctioned`, `isPep` | Boolean | Derived from topics array |
| `properties.birthDate` | `birthDate` | String | First value or null |
| `properties.birthPlace` | `birthPlace` | String | First value or null |
| `properties.gender` | `gender` | String | First value or null |
| `properties.nationality` | `nationality` | Array | Array of codes |
| `properties.country` | `country` | Array | Array of codes |
| `properties.position` | `position` | Array | Array of role strings |
| `properties.notes` | `notes` | Array | Array of descriptions |
| `properties.alias` | `alias` | Array | Array of alternate names |
| `properties.address` | `address` | Array | Array of addresses |
| `datasets` | `datasets` | Array | Array of source dataset IDs |

---

## Architecture

### YenteClient

**File:** [src/clients/YenteClient.js](src/clients/YenteClient.js)

**Purpose:** HTTP client for Yente API communication with automatic retry.

**Configuration:**
- Base URL: `YENTE_API_URL` environment variable (default: `http://localhost:8000`)
- Timeout: 5000ms per request
- Axios instance with axios-retry integration

**Methods:**

**`constructor({ baseURL, timeout })`**
- Initializes axios client with retry configuration
- Configures exponential backoff: 1s → 2s → 4s
- Retries on network errors and 5xx responses
- Logs retry attempts

**`async search({ name, limit, fuzzy, schema, country, requestId })`**
- Calls `GET /search/default?q={name}&limit={limit}&fuzzy={fuzzy}&...`
- Includes optional parameters only if provided
- Forwards `x-request-id` header if provided
- Returns response data from Yente

**Example:**
```javascript
const client = new YenteClient();
const response = await client.search({
  name: "John Doe",
  limit: 15,
  fuzzy: false,
  schema: "Person",
  country: "US",
  requestId: "req-123-abc"
});
```

### SanctionsService

**File:** [src/services/SanctionsService.js](src/services/SanctionsService.js)

**Purpose:** Business logic for entity sanctions checking.

**Dependencies:**
- YenteClient
- Logger
- SanctionEntity DTO

**Methods:**

**`constructor({ yenteClient })`**
- Dependency injection of YenteClient

**`async findEntities({ name, limit, fuzzy, schema, country, requestId })`**
- Queries Yente API via YenteClient
- Maps raw Yente results to SanctionEntity objects
- Returns transformed results with metadata
- Logs search completion with duration

**Returns:**
```javascript
{
  results: [SanctionEntity, ...],
  stats: {
    hitsCount: number,
    durationMs: number,
    source: string,
    requestId: string,
    searchParams: object
  }
}
```

**Error Handling:**
- Wraps Yente errors in UpstreamError
- Logs error details for debugging

### SanctionsController

**File:** [src/controllers/SanctionsController.js](src/controllers/SanctionsController.js)

**Purpose:** HTTP request handlers for `/health` and `/check` endpoints.

**Dependencies:**
- SanctionsService
- Logger

**Helper Functions:**

**`toBoolean(value)`**
- Converts string 'true'/'false' to boolean
- Returns `false` for non-true values
- Handles case-insensitive string comparison

**Methods:**

**`getHealth(req, res)`**
- Returns service status without requiring authentication

**`checkSanctions(req, res)` (async)**
- Validates and normalizes query parameters
- Generates or preserves request ID
- Calls SanctionsService.findEntities()
- Returns formatted JSON response
- Error handling for 400, 500, 502 responses

**Request Processing:**
1. Extract and validate `name` (required)
2. Parse and clamp `limit` (1-100)
3. Convert `fuzzy` string to boolean
4. Trim optional `schema` and `country`
5. Generate request ID or use provided
6. Log request details
7. Call SanctionsService
8. Format and return response

### SanctionEntity DTO

**File:** [src/models/SanctionEntity.dto.js](src/models/SanctionEntity.dto.js)

**Purpose:** Data Transfer Object for mapping Yente responses to simplified format.

**Constructor:**
```javascript
new SanctionEntity({
  id,           // String
  schema,       // String
  properties,   // Object (all Yente properties)
  caption,      // String
  datasets      // Array
})
```

**Properties:**
- `id` – Entity identifier
- `schema` – Entity type
- `name` – Extracted from properties.name or caption
- `country` – From properties.country or empty array
- `datasets` – Array of source datasets
- `properties` – Raw Yente properties object (for DTO completeness)

**Static Method:**

**`static fromYenteResponse(item)`**
- Factory method for creating SanctionEntity from Yente API response
- Safely extracts all fields with null/empty defaults
- Returns new SanctionEntity instance

### Logger

**File:** [src/utils/logger.js](src/utils/logger.js)

**Purpose:** Structured logging with Winston and daily file rotation.

**Features:**
- Console output (colorized)
- File output (daily rotation)
- Separate app and error logs
- 3-day retention
- 20MB max file size

**Log Levels:**
- `DEBUG` – Development details
- `INFO` – Request tracking
- `WARN` – Validation issues
- `ERROR` – Exceptions and failures

**Usage:**
```javascript
logger.info('Received check request', { requestId, name, limit });
logger.warn('Missing name parameter', { requestId });
logger.error('Yente API failed', { error: err.message });
```

---

## Testing

### Test Coverage

Integration tests verify endpoint behavior, data mapping, error handling, retry logic, and parameter forwarding to Yente.

**Test Categories:**

1. **Data Mapping (4 tests)**
   - Correct mapping of Yente response fields to simplified format
   - Extraction of sanctioning flags (`isSanctioned`, `isPep`) from `topics` array
   - Handling of sparse responses (missing optional fields)
   - Array field handling (joins vs. arrays)

2. **Error Handling (5 tests)**
   - Yente 500/503 errors → 502 Bad Gateway
   - Network errors (timeout, connection refused) → 502
   - Malformed Yente response → 502
   - Missing name parameter → 400
   - Graceful degradation on failures

3. **Limit Validation (6 tests)**
   - Negative values and 0 → clamped to 1
   - Values exceeding 100 → clamped to 100
   - Boundary values (1, 100) → accepted as-is
   - Invalid/non-numeric → defaults to 15

4. **Boolean Conversion (4 tests)**
   - String "true" → boolean true
   - String "false" → boolean false
   - Non-true string values → false
   - Edge cases (empty string, case-insensitive)

5. **Parameter Forwarding (9 tests)**
   - `name` parameter correctly forwarded as `q`
   - `limit` parameter with defaults and clamping
   - `fuzzy` string-to-boolean conversion
   - `country` mapped to `countries`
   - `schema` passed without modification
   - Optional parameters omitted if not provided
   - Multiple parameters combined correctly

6. **Response Structure (5 tests)**
   - Request tracking ID (from header or auto-generated)
   - Metadata (timestamp, source attribution)
   - Search parameters echoed in response
   - Original query string included
   - Data array structure

7. **Health Check (2 tests)**
   - `/health` returns UP status
   - No authentication required

**Total: 35 tests**

### Running Tests

```bash
npm test
```

Uses Jest with ES Modules support and mocked dependencies (no real Yente connection).

### Example Output

```bash
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

---

## Limitations and Future Work

- **No authentication or rate limiting** – OP-Adapter assumes it's called only from Core Service (behind API Gateway auth); direct access is unrestricted.

- **Retry strategy** – Retries up to 3 times on network errors and 5xx responses with exponential backoff (1s, 2s, 4s). Could add configurable retry count and delay strategy.

- **No response caching** – Every check hits Yente directly (even with retries). Consider Redis cache for frequently checked names to reduce latency and retry overhead.

- **Error details conditionally exposed** – 502 response includes error message only in development mode; production returns generic message for security.

- **Score interpretation not documented** – Score field returned from Yente but meaning varies; could add clarification or threshold logic.

- **No support for multiple names** – Only single name-based search; cannot check multiple entities in one request.

- **Yente service dependency** – If Yente is down, OP-Adapter will retry 3 times then fail; no fallback or degraded mode.

- **Log retention hardcoded** – 3-day retention and 20MB max file size configured in logger.js; not exposed via environment variables.

---

## License

**Proprietary** - All rights reserved

---

**Last Updated:** 2024-01-15  
**Version:** 1.0.0  
**Maintainer:** AML Checker Team
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