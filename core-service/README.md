Core Service
============

Sanctions checking and audit logging service for the AML Checker platform. Receives sanctioned entity queries via API Gateway, forwards them to the OP Adapter for validation, logs all searches to PostgreSQL audit table, and returns results with hit/match information. Enforces organization-based data isolation through context headers.

Stack and Dependencies
- Node.js 18, Express 4, ES Modules
- Sequelize 6 + PostgreSQL 15 (relational database)
- pg + pg-hstore (PostgreSQL adapter and data type serialization)
- axios (via OpAdapterClient for OP Adapter communication)
- cors (cross-origin request handling)
- winston + winston-daily-rotate-file (structured logging with file rotation)
- nodemon (dev dependency for auto-reload)
- jest + supertest (dev dependencies for integration testing)
- cross-env (dev dependency for cross-platform environment variables)

Environment and Configuration
- `DB_HOST` – PostgreSQL hostname; defaults to `postgres` in Docker network.
- `POSTGRES_USER` – PostgreSQL username; defaults to `admin`.
- `POSTGRES_PASSWORD` – PostgreSQL password; defaults to `tajne_haslo_postgres`.
- `POSTGRES_DB` – database name; defaults to `core_db`.
- `OP_ADAPTER_URL` – address of OP Adapter service; defaults to `http://op-adapter:3000` in Docker network.
- Application port in container: 3000; exposed and mapped via docker-compose.
- Database auto-syncs on startup using Sequelize `sync({ alter: true })` (see src/index.js).

Local Setup
1) `npm install`
2) Ensure PostgreSQL is running on `localhost:5432` with credentials from environment variables
3) `npm start` (for production) or `npm run dev` (for development with nodemon)
4) Set environment variables: `DB_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `OP_ADAPTER_URL`
5) `npm test` (for running integration tests)

Docker Compose Setup
- From project root directory: `docker compose up --build core-service`
- Service connects to PostgreSQL container automatically via Docker network.
- Endpoints available at http://localhost:3000 (or mapped port from docker-compose).

Endpoints
---------

### Service Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/health` | ❌ No | Returns service status and PostgreSQL connection state |

### Sanctions & Audit Endpoints

All sanctions endpoints require **organization context** via `x-org-id` header (injected by API Gateway after JWT or API Key authentication).

| Method | Endpoint | Auth Required | Description | Required Headers | Query Parameters |
|--------|----------|---------------|-------------|------------------|------------------|
| GET | `/check` | ✅ Yes (org context) | Check entity against sanctions/PEP lists; creates audit log | `x-org-id` (required)<br>`x-user-id` (optional)<br>`x-user-email` (optional)<br>`x-request-id` (optional) | `name` (required)<br>`limit` (optional)<br>`fuzzy` (optional)<br>`schema` (optional)<br>`country` (optional) |
| GET | `/history` | ✅ Yes (org context or superadmin) | Retrieve paginated audit logs with filtering | `x-org-id` (required for non-superadmin)<br>`x-role` (optional, for superadmin) | `page` (default: 1)<br>`limit` (default: 20)<br>`search` (text filter)<br>`hasHit` (true/false)<br>`startDate` (ISO date)<br>`endDate` (ISO date)<br>`userId` (filter by user)<br>`orgId` (superadmin only) |
| GET | `/stats` | ✅ Yes (org context) | Get aggregated statistics for organization | `x-org-id` (required) | None |

### Endpoint Details

#### `/check` - Sanctions Check
**Purpose:** Validate entity against OpenSanctions data (via OP Adapter), log to audit trail, return results.

**Query Parameters:**
- `name` (required) - Entity name to check
- `limit` (optional) - Maximum results to return (forwarded to OP Adapter)
- `fuzzy` (optional) - Enable fuzzy matching (forwarded to OP Adapter)
- `schema` (optional) - Entity type filter: Person, Company, etc. (forwarded to OP Adapter)
- `country` (optional) - ISO country code filter (forwarded to OP Adapter)

**Headers:**
- `x-org-id` (required) - Organization context for data isolation
- `x-user-id` (optional) - User ID from JWT; defaults to `"API"` if absent (for API Key auth)
- `x-user-email` (optional) - User email from JWT
- `x-request-id` (optional) - Request tracking ID; auto-generated if missing

**Response:**
```json
{
  "hits_count": 1,
  "data": [
    {
      "name": "Vladimir Putin",
      "score": 1.0,
      "birthDate": "1952-10-07",
      "country": ["RU"],
      "datasets": ["ofac"],
      "isSanctioned": true,
      "isPep": false
    }
  ],
  "meta": { "requestId": "...", "source": "OpenSanctions" }
}
```

**Audit Logging:**
- Creates AuditLog record with: organizationId, userId, searchQuery, hasHit, hitsCount
- Enriches with best match: entityName, entityScore, entityBirthDate, entityGender, entityCountries, entityDatasets, entityDescription, isSanctioned, isPep

**Error Responses:**
- 400 - Missing `name` parameter or empty after trim
- 403 - Missing `x-org-id` header (organization context required)
- 502 - OP Adapter error (downstream service failure)
- 500 - Internal server error

---

#### `/history` - Audit Log History
**Purpose:** Retrieve paginated audit logs with advanced filtering; supports organization-scoped access and superadmin cross-organization queries.

**Query Parameters:**
- `page` (optional, default: 1) - Page number for pagination
- `limit` (optional, default: 20) - Items per page
- `search` (optional) - Text filter for entity names (case-insensitive)
- `hasHit` (optional) - Filter by hit status: `true` or `false`
- `startDate` (optional) - Filter logs from this date (ISO format)
- `endDate` (optional) - Filter logs until this date (ISO format)
- `userId` (optional) - Filter by specific user ID
- `orgId` (optional, superadmin only) - Filter by organization ID

**Headers:**
- `x-org-id` (required for non-superadmin) - Organization context for data isolation
- `x-role` (optional) - User role; `superadmin` can omit `x-org-id` and use `orgId` parameter

**Response:**
```json
{
  "data": [
    {
      "id": "<uuid>",
      "organizationId": "<org_id>",
      "userId": "API",
      "searchQuery": "Putin",
      "hasHit": true,
      "hitsCount": 1,
      "entityName": "Vladimir Putin",
      "entityScore": 1,
      "entityBirthDate": "1952-10-07",
      "entityCountries": "RU",
      "entityDatasets": "ofac",
      "isSanctioned": true,
      "isPep": false,
      "createdAt": "2025-12-28T10:30:00Z"
    }
  ],
  "meta": {
    "totalItems": 150,
    "totalPages": 8,
    "currentPage": 1,
    "itemsPerPage": 20
  }
}
```

**Data Isolation:**
- Regular users: see only their organization's logs (via `x-org-id`)
- Superadmins: can view all logs or filter by `orgId` parameter

**Error Responses:**
- 403 - Missing `x-org-id` for non-superadmin users
- 500 - Database error

---

#### `/stats` - Organization Statistics
**Purpose:** Get aggregated statistics for organization: total checks, sanction hits, PEP hits, and recent logs.

**Headers:**
- `x-org-id` (required) - Organization context

**Response:**
```json
{
  "totalChecks": 150,
  "sanctionHits": 25,
  "pepHits": 10,
  "recentLogs": [
    {
      "id": "<uuid>",
      "searchQuery": "John Doe",
      "isSanctioned": false,
      "isPep": false,
      "createdAt": "2025-12-28T10:30:00Z"
    }
  ]
}
```

**Statistics Breakdown:**
- `totalChecks` - Total number of checks for organization
- `sanctionHits` - Number of checks with `isSanctioned: true`
- `pepHits` - Number of checks with `isPep: true`
- `recentLogs` - Last 100 audit logs ordered by creation date (descending)

**Error Responses:**
- 400 - Missing `x-org-id` header
- 500 - Database error

Usage Examples
- Health check:
```bash
curl http://localhost:3000/health
```

- Sanctions check (via API Gateway with JWT):
```bash
curl -X GET "http://localhost:3000/check?name=John%20Doe" \
	-H "x-org-id: <ORG_ID>" \
	-H "x-user-id: <USER_ID>"
```

- Sanctions check (via API Gateway with API Key – userId stored as `API`):
```bash
curl -X GET "http://localhost:3000/check?name=Jane%20Smith" \
	-H "x-org-id: <ORG_ID>"
```

- Audit history for organization (paginated, page 1, 20 items per page):
```bash
curl -X GET http://localhost:3000/history \
	-H "x-org-id: <ORG_ID>"
```

- Audit history with pagination (page 2, 50 items per page):
```bash
curl -X GET "http://localhost:3000/history?page=2&limit=50" \
	-H "x-org-id: <ORG_ID>"
```

- Audit history with text search (search for entity names containing "John"):
```bash
curl -X GET "http://localhost:3000/history?search=John" \
	-H "x-org-id: <ORG_ID>"
```

- Audit history filtered by hit status (only hits):
```bash
curl -X GET "http://localhost:3000/history?hasHit=true" \
	-H "x-org-id: <ORG_ID>"
```

- Audit history with date range filter (between specific dates):
```bash
curl -X GET "http://localhost:3000/history?startDate=2025-12-01T00:00:00Z&endDate=2025-12-31T23:59:59Z" \
	-H "x-org-id: <ORG_ID>"
```

- Audit history filtered by user ID (e.g., specific user or API key call stored as `API`):
```bash
curl -X GET "http://localhost:3000/history?userId=<USER_ID>" \
	-H "x-org-id: <ORG_ID>"
```

- Combine multiple filters (search + date range + pagination):
```bash
curl -X GET "http://localhost:3000/history?search=John&startDate=2025-12-01T00:00:00Z&endDate=2025-12-31T23:59:59Z&page=1&limit=10" \
	-H "x-org-id: <ORG_ID>"
```

- Audit history for all organizations (superadmin only):
```bash
curl -X GET http://localhost:3000/history \
	-H "Authorization: Bearer <JWT_TOKEN_SUPERADMIN>" \
	-H "x-role: superadmin"
```

- Audit history for specific organization (superadmin filtering):
```bash
curl -X GET "http://localhost:3000/history?orgId=<ORG_ID>" \
	-H "Authorization: Bearer <JWT_TOKEN_SUPERADMIN>" \
	-H "x-role: superadmin"
```

- Organization statistics (total checks, sanction hits, PEP hits, recent logs):
```bash
curl -X GET http://localhost:3000/stats \
	-H "x-org-id: <ORG_ID>"
```

Response Structure
- `/health`:
```json
{ "service": "core-service", "status": "UP", "database": "Connected" }
```

- `/check` (success; passthrough from OP Adapter):
```json
{
  "hits_count": 1,
  "data": [
    {
      "name": "Vladimir Putin",
      "score": 1.0,
      "birthDate": "1952-10-07",
      "country": ["RU"],
      "datasets": ["ofac"],
      "isSanctioned": true,
      "isPep": false
    }
  ],
  "meta": { "requestId": "...", "source": "OpenSanctions" }
}
```

- `/history` (success; example with pagination metadata):
```json
{
  "data": [
    {
      "id": "<uuid>",
      "organizationId": "<org_id>",
      "userId": "API",
      "searchQuery": "Putin",
      "hasHit": true,
      "hitsCount": 1,
      "entityName": "Vladimir Putin",
      "entityScore": 1,
      "entityBirthDate": "1952-10-07",
      "entityCountries": "RU",
      "entityDatasets": "ofac",
      "isSanctioned": true,
      "isPep": false,
      "createdAt": "2025-12-28T10:30:00Z"
    }
  ],
  "meta": {
    "totalItems": 1,
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 20
  }
}
```

- `/stats` (success; aggregated statistics for organization):
```json
{
  "totalChecks": 150,
  "sanctionHits": 25,
  "pepHits": 10,
  "recentLogs": [
    {
      "id": "<uuid>",
      "searchQuery": "John Doe",
      "isSanctioned": false,
      "isPep": false,
      "createdAt": "2025-12-28T10:30:00Z"
    }
  ]
}
```

How It Works (High Level)
- **Request Flow**: Client sends `GET /check?name=<entity>` with organization context in header → Core Service validates `name` and `x-org-id` → forwards to OP Adapter via `OpAdapterClient` → receives sanctions result with `hits_count` and `data` → creates AuditLog record (organization-scoped) → returns adapter payload.
- **Audit Logging**: Each search stores organization ID, user ID (`API` default), search query, hit flag/count, and best-match enrichment (name, score, birthDate, gender, countries, datasets, description/notes, isPep, isSanctioned). Supports compliance and search history per org.
- **Statistics Aggregation**: `/stats` endpoint queries AuditLog table with organization-scoped filters to calculate totalChecks (all logs), sanctionHits (isSanctioned=true), pepHits (isPep=true), and retrieves last 100 logs ordered by createdAt descending.
- **Pagination and Filtering**: `/history` supports pagination with filters: text search by entity name, hit status, date range, user ID, and (superadmin only) organization ID.
- **Data Isolation**: Organization-based access enforced on `/check`, `/history`, and `/stats` via `x-org-id`; `x-role: superadmin` can omit org header on `/history` and optionally filter by `orgId`.
- **OP Adapter Integration**: Core Service delegates sanctions validation to OP Adapter through `OpAdapterClient`, adding logging and audit persistence around the call.
- **Database Sync**: Sequelize auto-syncs schema on startup (`sync({ alter: true })`), creating AuditLog if missing.

Data Models
- **AuditLog**:
	- `id` (UUID, primary key)
	- `organizationId` (string, indexed)
	- `userId` (string; defaults to `API` when header absent)
	- `searchQuery` (string; the entity name queried)
	- `hasHit` (boolean), `hitsCount` (integer)
	- Best match enrichment: `entityName`, `entityScore`, `entityBirthDate`, `entityGender`, `entityCountries`, `entityDatasets`, `entityDescription`, `isSanctioned`, `isPep`
	- `createdAt` (timestamp; auto-set)

Testing
-------

Integration tests verify endpoint behavior, validation, data isolation, error handling, and adapter/database interactions. Tests use Jest + Supertest with ESM support via `jest.unstable_mockModule` to mock dependencies before app import.

Test Files
- `tests/check.test.js` – `/check` endpoint (14 tests).
	- **Request Validation** (3 tests): Missing `name` → 400; missing `x-org-id` → 403; empty name after trim → 400.
	- **Happy Paths** (3 tests): Successful response with AuditLog persistence; empty results (no matches); multiple matches handling.
	- **Query Parameters** (1 test): Optional parameters (limit, fuzzy, schema, country) forwarded to adapter.
	- **Error Handling** (3 tests): Op-Adapter error → 502; unexpected errors → 502; AuditLog failure (continues operation).
	- **Authentication Context** (2 tests): Missing userID (API key auth, stored as 'API'); userEmail header handling.
	- **Entity Field Mapping** (2 tests): Whitespace trimming; complete entity fields (gender, score, description, position, notes).
	- Mocks: `OpAdapterClient`, `AuditLog`, `logger`.
- `tests/history.test.js` – `/history` endpoint (13 tests).
	- **Security & Data Isolation** (3 tests): Missing `x-org-id` → 403 (non-superadmin); organization-scoped queries; superadmin access without org context.
	- **Pagination** (3 tests): Paginated results with metadata; default values (page=1, limit=20); page beyond available data.
	- **Filtering** (6 tests): Search by query; hasHit=true/false; userId filter; date range (startDate/endDate); superadmin orgId filter.
	- **Error Handling** (1 test): Database error → 500.
	- Mocks: `OpAdapterClient` (constructed in app), `AuditLog`, `logger`.
- `tests/stats.test.js` – `/stats` endpoint (5 tests).
	- **Happy Path** (1 test): Returns aggregated statistics (totalChecks, sanctionHits, pepHits, recentLogs).
	- **Security** (1 test): Missing `x-org-id` → 400.
	- **Data Isolation** (2 tests): Organization with no data; statistics scoped to organization only.
	- **Error Handling** (1 test): Database error → 500.
	- Mocks: `OpAdapterClient` (constructed in app), `AuditLog`, `logger`.
- `tests/health.test.js` – `/health` endpoint (2 tests).
	- **Database Connected** (1 test): Returns status UP with database Connected.
	- **Database Disconnected** (1 test): Returns status UP with database Disconnected (graceful degradation).
	- Mocks: `sequelize.authenticate` (database connection), `OpAdapterClient`, `AuditLog`, `logger`.

Running Tests
- Command: `npm test` (runs all tests with verbose output)
- Uses ESM via `cross-env NODE_OPTIONS=--experimental-vm-modules jest --verbose`
- Tests run isolated from real DB/adapter; all externals mocked before app import

Test Coverage
- **Request Validation**: Tests verify proper HTTP status codes for missing/invalid inputs (missing name, missing x-org-id, empty name after trim).
- **Security & Data Isolation**: Organization-based access control on `/check`, `/history`, and `/stats`; superadmin exemption via `x-role` header; org-scoped database queries.
- **Business Logic**: Audit log persistence with best-match enrichment; entity field mapping (name, score, birthDate, gender, countries, datasets, description); hit counting and flagging.
- **Error Handling**: Adapter errors (502), database errors (500), unexpected errors; graceful degradation when AuditLog fails (operation continues).
- **Authentication Context**: JWT authentication (user context) vs API Key authentication (stored as 'API'); userEmail header handling.
- **Pagination & Filtering**: Metadata calculation (totalItems, totalPages, currentPage, itemsPerPage); query filters (search, hasHit, userId, startDate/endDate, orgId for superadmin); default values.
- **Query Parameters**: Optional parameters forwarded to Op-Adapter (limit, fuzzy, schema, country); whitespace trimming.
- **Statistics Aggregation**: Count queries for totalChecks, sanctionHits, pepHits; recent logs retrieval (last 100); organization-scoped aggregations.
- **Health Monitoring**: Service status reporting; database connection state (Connected/Disconnected).

Example Test Execution
```bash
npm test
```

Expected output:
```
PASS  tests/health.test.js
  GET /health Integration Test
    ✓ should return healthy status with connected database
    ✓ should return healthy status with disconnected database

PASS  tests/history.test.js
  GET /history Integration Test
    ✓ should return 403 if x-org-id is missing (Security)
    ✓ should return paginated results (Pagination)
    ✓ should enforce data isolation for regular users
    ✓ should allow filtering by search query
    ✓ should allow superadmin to access without x-org-id
    ✓ should filter by organization for superadmin when orgId provided
    ✓ should filter by hasHit parameter
    ✓ should filter by hasHit=false parameter
    ✓ should filter by userId parameter
    ✓ should filter by date range (startDate and endDate)
    ✓ should use default pagination values when not provided
    ✓ should handle page beyond available data
    ✓ should return 500 on database error

PASS  tests/stats.test.js
  GET /stats Integration Test
    ✓ should return statistics for organization (Happy Path)
    ✓ should return 400 if x-org-id is missing
    ✓ should handle organization with no data
    ✓ should enforce data isolation (only stats for specified org)
    ✓ should return 500 on database error

PASS  tests/check.test.js
  GET /check Integration Test
    ✓ should return 400 if name is missing
    ✓ should return 403 if x-org-id is missing
    ✓ should process successful response from Op-Adapter and save log
    ✓ should return empty results when no matches found
    ✓ should handle multiple matches correctly
    ✓ should pass optional query parameters to adapter
    ✓ should return 502 when Op-Adapter returns error
    ✓ should return 500 on unexpected errors
    ✓ should handle missing userID gracefully (API key authentication)
    ✓ should handle userEmail header when provided
    ✓ should trim whitespace from name parameter
    ✓ should reject empty name after trimming
    ✓ should continue operation even if AuditLog fails
    ✓ should map all entity fields correctly

Test Suites: 4 passed, 4 total
Tests:       34 passed, 34 total
Time:        2.025 s
```