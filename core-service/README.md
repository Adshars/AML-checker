Core Service
============

Sanctions checking and audit logging service for the AML Checker platform. Receives sanctioned entity queries via API Gateway, forwards them to the OP Adapter for validation, logs all searches to PostgreSQL audit table, and returns results with hit/match information. Enforces organization-based data isolation through context headers.

**Version:** 1.0.0  
**Node.js:** 18+ (Alpine)  
**Type:** ES Modules

## Table of Contents

- [Stack and Dependencies](#stack-and-dependencies)
- [Environment and Configuration](#environment-and-configuration)
- [Local Setup](#local-setup)
- [Docker Compose Setup](#docker-compose-setup)
- [Architecture](#architecture)
  - [Design Pattern](#design-pattern)
  - [Key Components](#key-components)
  - [Request Flow](#request-flow)
  - [Data Isolation](#data-isolation)
- [Endpoints](#endpoints)
  - [Service Endpoints](#service-endpoints)
  - [Sanctions & Audit Endpoints](#sanctions--audit-endpoints)
  - [Endpoint Details](#endpoint-details)
- [Usage Examples](#usage-examples)
  - [Health Check](#health-check)
  - [Sanctions Check with JWT](#sanctions-check-with-jwt)
  - [Sanctions Check with API Key](#sanctions-check-with-api-key)
  - [Get Audit History](#get-audit-history)
  - [Filter History by Date Range](#filter-history-by-date-range)
  - [Get Organization Statistics](#get-organization-statistics)
- [Response Structure](#response-structure)
- [Data Models](#data-models)
- [How It Works](#how-it-works-high-level)
- [Testing](#testing)
  - [Test Files](#test-files)
  - [Running Tests](#running-tests)
  - [Test Coverage](#test-coverage)
  - [Example Test Execution](#example-test-execution)
- [License](#license)

---

## Stack and Dependencies

**Core Framework:**
- **Node.js 18+** (Alpine) – Lightweight production runtime
- **Express** 4.18.2 – Fast, minimalist web framework with ES Modules support

**Database & ORM:**
- **PostgreSQL 15** – Relational database for audit logs
- **Sequelize** 6.35.0 – Promise-based ORM with auto-sync
- **pg** 8.11.3 + **pg-hstore** 2.3.4 – PostgreSQL adapter and data serialization

**HTTP Client & Integration:**
- **axios** 1.6.0 – HTTP client for OP Adapter communication
- **cors** 2.8.5 – Cross-Origin Resource Sharing configuration

**Logging:**
- **winston** 3.19.0 – Structured logging with multiple transports
- **winston-daily-rotate-file** 5.0.0 – Automatic log rotation (daily, error/combined logs)

**Development & Testing:**
- **nodemon** 3.0.1 – Auto-reload during development
- **jest** 30.2.0 – Test runner with ES Modules support
- **supertest** 7.2.2 – HTTP assertions for integration testing
- **cross-env** 10.1.0 – Cross-platform environment variables

## Environment and Configuration

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `DB_HOST` | PostgreSQL hostname | `postgres` (Docker network) |
| `POSTGRES_USER` | PostgreSQL username | `admin` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `tajne_haslo_postgres` |
| `POSTGRES_DB` | Database name | `core_db` |
| `OP_ADAPTER_URL` | OP Adapter service address | `http://op-adapter:3000` |
| `PORT` | Application port (container) | `3000` |

**Database Configuration:**
- Auto-syncs schema on startup using Sequelize `sync({ alter: true })`
- Creates `AuditLog` table if not exists
- See [src/index.js](src/index.js) for initialization logic

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure PostgreSQL:**
   - Ensure PostgreSQL is running on `localhost:5432`
   - Create database: `core_db`
   - Configure credentials via environment variables

3. **Set environment variables:**
   ```bash
   export DB_HOST=localhost
   export POSTGRES_USER=admin
   export POSTGRES_PASSWORD=tajne_haslo_postgres
   export POSTGRES_DB=core_db
   export OP_ADAPTER_URL=http://localhost:3000
   ```

4. **Start the service:**
   ```bash
   npm start         # Production mode
   npm run dev       # Development mode with nodemon
   ```

5. **Run tests:**
   ```bash
   npm test
   ```

## Docker Compose Setup

**From project root directory:**
```bash
docker compose up --build core-service
```

**Configuration:**
- Service connects to PostgreSQL container automatically via Docker network
- Endpoints available at `http://localhost:3000` (or mapped port from docker-compose)
- Database automatically syncs schema on startup
- Logs stored in `logs/` directory with daily rotation

## Architecture

### Design Pattern

**Dependency Injection & Composition Root:**
- **createApp()** function ([src/app.js](src/app.js)) builds Express app with DI
- Manual composition of dependencies (OpAdapterClient → SanctionsCoreService → SanctionsController)
- No IoC container, explicit dependency graph

**Layered Architecture:**
```
Controllers (HTTP layer)
    ↓
Services (Business logic)
    ↓
Clients (External API communication)
    ↓
Models (Database ORM)
```

### Key Components

**Controllers** ([src/controllers/](src/controllers/))
- [sanctionsController.js](src/controllers/sanctionsController.js) – Sanctions check, statistics, health check
- [historyController.js](src/controllers/historyController.js) – Audit log retrieval with pagination/filtering

**Services** ([src/services/](src/services/))
- [SanctionsCoreService.js](src/services/SanctionsCoreService.js) – Business logic for sanctions screening and audit logging

**Clients** ([src/clients/](src/clients/))
- [OpAdapterClient.js](src/clients/OpAdapterClient.js) – HTTP client for OP Adapter communication (axios-based)

**Models** ([src/models/](src/models/))
- [AuditLog.js](src/models/AuditLog.js) – Sequelize model for audit trail with organization-scoped queries

**Configuration** ([src/config/](src/config/))
- [database.js](src/config/database.js) – Sequelize PostgreSQL connection configuration

**Utilities** ([src/utils/](src/utils/))
- [logger.js](src/utils/logger.js) – Winston logger with daily file rotation
- [auditLogger.js](src/utils/auditLogger.js) – Audit log enrichment helper

### Request Flow

1. **Client Request** → API Gateway validates authentication (JWT/API Key)
2. **Gateway Injection** → Adds `x-org-id`, `x-user-id`, `x-user-email`, `x-request-id` headers
3. **Core Service** → Validates required headers and query parameters
4. **OP Adapter Call** → Forwards request to OP Adapter via `OpAdapterClient`
5. **Audit Logging** → Saves search query and results to PostgreSQL `AuditLog` table
6. **Response** → Returns OP Adapter payload with sanctions data

### Data Isolation

**Organization-Scoped Queries:**
- All endpoints require `x-org-id` header (injected by API Gateway)
- Database queries automatically filter by `organizationId`
- Prevents cross-organization data access

**Superadmin Exemption:**
- `/history` endpoint allows `x-role: superadmin` to omit `x-org-id`
- Superadmins can filter by `orgId` query parameter to view specific organization data
- Regular users always restricted to their organization

---

## Endpoints
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

## Usage Examples

### Health Check

**Request:**
```bash
curl http://localhost:3000/health
```

**Response (200 OK):**
```json
{
  "service": "core-service",
  "status": "UP",
  "database": "Connected"
}
```

### Sanctions Check with JWT

**Request:**
```bash
curl -X GET "http://localhost:3000/check?name=John%20Doe" \
  -H "x-org-id: <ORG_ID>" \
  -H "x-user-id: <USER_ID>" \
  -H "x-user-email: user@example.com"
```

**Response (200 OK):**
```json
{
  "hits_count": 1,
  "data": [
    {
      "name": "John Doe",
      "score": 0.95,
      "birthDate": "1980-05-15",
      "country": ["US"],
      "datasets": ["ofac"],
      "isSanctioned": true,
      "isPep": false
    }
  ],
  "meta": {
    "requestId": "abc-123-def-456",
    "source": "OpenSanctions"
  }
}
```

### Sanctions Check with API Key

**Request:**
```bash
curl -X GET "http://localhost:3000/check?name=Jane%20Smith" \
  -H "x-org-id: <ORG_ID>"
```

ℹ️ **Note:** When using API Key authentication, `userId` is stored as `"API"` in audit logs.

### Get Audit History

**Request (Paginated, page 1, 20 items per page):**
```bash
curl -X GET http://localhost:3000/history \
  -H "x-org-id: <ORG_ID>"
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid-1",
      "organizationId": "org-uuid",
      "userId": "user-uuid",
      "searchQuery": "John Doe",
      "hasHit": true,
      "hitsCount": 1,
      "entityName": "John Doe",
      "entityScore": 0.95,
      "isSanctioned": true,
      "isPep": false,
      "createdAt": "2026-01-29T10:30:00Z"
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

**With Pagination:**
```bash
curl -X GET "http://localhost:3000/history?page=2&limit=50" \
  -H "x-org-id: <ORG_ID>"
```

**With Text Search:**
```bash
curl -X GET "http://localhost:3000/history?search=John" \
  -H "x-org-id: <ORG_ID>"
```

**Filter by Hit Status:**
```bash
curl -X GET "http://localhost:3000/history?hasHit=true" \
  -H "x-org-id: <ORG_ID>"
```

### Filter History by Date Range

**Request:**
```bash
curl -X GET "http://localhost:3000/history?startDate=2026-01-01T00:00:00Z&endDate=2026-01-31T23:59:59Z" \
  -H "x-org-id: <ORG_ID>"
```

**Filter by User ID:**
```bash
curl -X GET "http://localhost:3000/history?userId=<USER_ID>" \
  -H "x-org-id: <ORG_ID>"
```

**Combine Multiple Filters:**
```bash
curl -X GET "http://localhost:3000/history?search=John&startDate=2026-01-01T00:00:00Z&endDate=2026-01-31T23:59:59Z&page=1&limit=10" \
  -H "x-org-id: <ORG_ID>"
```

**Superadmin - All Organizations:**
```bash
curl -X GET http://localhost:3000/history \
  -H "x-role: superadmin"
```

**Superadmin - Specific Organization:**
```bash
curl -X GET "http://localhost:3000/history?orgId=<ORG_ID>" \
  -H "x-role: superadmin"
```

### Get Organization Statistics

**Request:**
```bash
curl -X GET http://localhost:3000/stats \
  -H "x-org-id: <ORG_ID>"
```

**Response (200 OK):**
```json
{
  "totalChecks": 150,
  "sanctionHits": 25,
  "pepHits": 10,
  "recentLogs": [
    {
      "id": "uuid-1",
      "searchQuery": "John Doe",
      "isSanctioned": false,
      "isPep": false,
      "createdAt": "2026-01-29T10:30:00Z"
    }
  ]
}
```

---

## Response Structure

**Health Check:**
```json
{
  "service": "core-service",
  "status": "UP",
  "database": "Connected"
}
```

**Sanctions Check (Success):**
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
  "meta": {
    "requestId": "abc-123-def-456",
    "source": "OpenSanctions"
  }
}
```

**Audit History (Paginated):**
```json
{
  "data": [
    {
      "id": "uuid-1",
      "organizationId": "org-uuid",
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
      "createdAt": "2026-01-29T10:30:00Z"
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

**Organization Statistics:**
```json
{
  "totalChecks": 150,
  "sanctionHits": 25,
  "pepHits": 10,
  "recentLogs": [
    {
      "id": "uuid-1",
      "searchQuery": "John Doe",
      "isSanctioned": false,
      "isPep": false,
      "createdAt": "2026-01-29T10:30:00Z"
    }
  ]
}
```

**Error Responses:**
```json
{
  "error": "Missing required parameter: name"
}
```

```json
{
  "error": "Organization context required (x-org-id header missing)"
}
```

```json
{
  "error": "Failed to communicate with Op-Adapter",
  "details": "Connection timeout"
}
```

---

## Data Models

**AuditLog** ([src/models/AuditLog.js](src/models/AuditLog.js))
```javascript
{
  id: UUID (primary key, auto-generated),
  organizationId: STRING (indexed, required),
  userId: STRING (defaults to "API" if absent),
  searchQuery: STRING (entity name queried),
  hasHit: BOOLEAN,
  hitsCount: INTEGER,
  
  // Best match enrichment:
  entityName: STRING,
  entityScore: FLOAT,
  entityBirthDate: STRING,
  entityGender: STRING,
  entityCountries: STRING,
  entityDatasets: STRING,
  entityDescription: STRING,
  isSanctioned: BOOLEAN,
  isPep: BOOLEAN,
  
  createdAt: DATE (auto-generated)
}
```

**Indexes:**
- `organizationId` - Fast organization-scoped queries
- `createdAt` - Efficient date range filtering

---

## How It Works (High Level)

### Request Flow
1. **Client Request** → Sends `GET /check?name=<entity>` with organization context header
2. **Validation** → Core Service validates `name` parameter and `x-org-id` header
3. **OP Adapter Call** → Forwards request to OP Adapter via `OpAdapterClient`
4. **Response Processing** → Receives sanctions result with `hits_count` and `data`
5. **Audit Logging** → Creates AuditLog record (organization-scoped)
6. **Response** → Returns OP Adapter payload to client

### Audit Logging
- Each search stores:
  - Organization ID (data isolation)
  - User ID (`"API"` default for API Key auth)
  - Search query (entity name)
  - Hit flag and count
  - Best match enrichment:
    - Entity name, score, birthDate, gender
    - Countries, datasets, description/notes
    - Sanctions flag (`isSanctioned`)
    - PEP flag (`isPep`)
- Supports compliance requirements and search history per organization

### Statistics Aggregation
- `/stats` endpoint queries `AuditLog` table with organization-scoped filters
- Calculates:
  - `totalChecks` - All logs for organization
  - `sanctionHits` - Logs with `isSanctioned=true`
  - `pepHits` - Logs with `isPep=true`
  - `recentLogs` - Last 100 logs ordered by `createdAt DESC`

### Pagination and Filtering
- `/history` supports:
  - **Pagination**: `page`, `limit` parameters with metadata
  - **Text Search**: Entity name filtering (case-insensitive)
  - **Hit Status**: `hasHit` boolean filter
  - **Date Range**: `startDate`, `endDate` ISO format
  - **User Filter**: `userId` parameter
  - **Superadmin**: `orgId` parameter (cross-organization queries)

### Data Isolation
- Organization-based access enforced on `/check`, `/history`, `/stats`
- Header: `x-org-id` (injected by API Gateway)
- Superadmins: Can omit `x-org-id` on `/history` and use `orgId` parameter
- Database queries automatically filter by `organizationId`

### OP Adapter Integration
- Core Service delegates sanctions validation to OP Adapter
- Adds logging and audit persistence around the call
- Forwards optional query parameters: `limit`, `fuzzy`, `schema`, `country`

### Database Sync
- Sequelize auto-syncs schema on startup: `sync({ alter: true })`
- Creates `AuditLog` table if missing
- Updates schema if model changes detected

---

## Testing

The Core Service includes comprehensive integration tests that verify endpoint behavior, request validation, data isolation, error handling, and OP Adapter/database interactions.

**Test Framework:**
- **jest** 30.2.0 – Test runner with ES Modules support
- **supertest** 7.2.2 – HTTP assertions
- **Mocking**: Jest mocks for OpAdapterClient, AuditLog, logger, sequelize

**Test Coverage:** 34 integration tests across all endpoints

### Test Files

**tests/check.test.js** – `/check` endpoint (14 tests)
- ✅ Request Validation (3 tests): Missing `name` → 400; missing `x-org-id` → 403; empty name after trim → 400
- ✅ Happy Paths (3 tests): Successful response with AuditLog persistence; empty results (no matches); multiple matches handling
- ✅ Query Parameters (1 test): Optional parameters (limit, fuzzy, schema, country) forwarded to adapter
- ✅ Error Handling (3 tests): Op-Adapter error → 502; unexpected errors → 502; AuditLog failure (continues operation)
- ✅ Authentication Context (2 tests): Missing userID (API key auth, stored as 'API'); userEmail header handling
- ✅ Entity Field Mapping (2 tests): Whitespace trimming; complete entity fields (gender, score, description, position, notes)

**tests/history.test.js** – `/history` endpoint (13 tests)
- ✅ Security & Data Isolation (3 tests): Missing `x-org-id` → 403 (non-superadmin); organization-scoped queries; superadmin access without org context
- ✅ Pagination (3 tests): Paginated results with metadata; default values (page=1, limit=20); page beyond available data
- ✅ Filtering (6 tests): Search by query; hasHit=true/false; userId filter; date range (startDate/endDate); superadmin orgId filter
- ✅ Error Handling (1 test): Database error → 500

**tests/stats.test.js** – `/stats` endpoint (5 tests)
- ✅ Happy Path (1 test): Returns aggregated statistics (totalChecks, sanctionHits, pepHits, recentLogs)
- ✅ Security (1 test): Missing `x-org-id` → 400
- ✅ Data Isolation (2 tests): Organization with no data; statistics scoped to organization only
- ✅ Error Handling (1 test): Database error → 500

**tests/health.test.js** – `/health` endpoint (2 tests)
- ✅ Database Connected (1 test): Returns status UP with database Connected
- ✅ Database Disconnected (1 test): Returns status UP with database Disconnected (graceful degradation)

### Running Tests

**Command:**
```bash
npm test
```

**Configuration:**
- Uses ESM via `cross-env NODE_OPTIONS=--experimental-vm-modules jest --verbose`
- Tests run isolated from real DB/adapter
- All externals mocked before app import
- `NODE_ENV=test` prevents server startup

**Mocked Dependencies:**
- `OpAdapterClient` – HTTP client for OP Adapter
- `AuditLog` – Sequelize database model
- `logger` – Winston logger
- `sequelize.authenticate` – Database connection

### Test Coverage

**Request Validation:**
- Verifies proper HTTP status codes for missing/invalid inputs
- Tests missing name, missing x-org-id, empty name after trim

**Security & Data Isolation:**
- Organization-based access control on `/check`, `/history`, `/stats`
- Superadmin exemption via `x-role` header
- Org-scoped database queries

**Business Logic:**
- Audit log persistence with best-match enrichment
- Entity field mapping (name, score, birthDate, gender, countries, datasets, description)
- Hit counting and flagging

**Error Handling:**
- Adapter errors (502)
- Database errors (500)
- Unexpected errors
- Graceful degradation when AuditLog fails (operation continues)

**Authentication Context:**
- JWT authentication (user context)
- API Key authentication (stored as 'API')
- userEmail header handling

**Pagination & Filtering:**
- Metadata calculation (totalItems, totalPages, currentPage, itemsPerPage)
- Query filters (search, hasHit, userId, startDate/endDate, orgId for superadmin)
- Default values handling

**Query Parameters:**
- Optional parameters forwarded to Op-Adapter (limit, fuzzy, schema, country)
- Whitespace trimming

**Statistics Aggregation:**
- Count queries for totalChecks, sanctionHits, pepHits
- Recent logs retrieval (last 100)
- Organization-scoped aggregations

**Health Monitoring:**
- Service status reporting
- Database connection state (Connected/Disconnected)

### Example Test Execution

**Command:**
```bash
npm test
```

**Expected output:**
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

---

## License

MIT