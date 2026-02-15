Core Service
============

Sanctions checking and audit logging service for the AML Checker platform. Receives sanctioned entity queries via API Gateway, forwards them to the OP Adapter, logs all searches to PostgreSQL audit table, and returns results with hit/match information. Enforces organization-based data isolation through context headers.

**Version:** 1.0.0  
**Node.js:** 18+ (Alpine)  
**Type:** ES Modules

## Table of Contents

- [Stack and Dependencies](#stack-and-dependencies)
- [Environment and Configuration](#environment-and-configuration)
- [Local Setup](#local-setup)
- [Docker Compose Setup](#docker-compose-setup)
- [Architecture](#architecture)
- [Endpoints](#endpoints)
- [Usage Examples](#usage-examples)
- [Response Structure](#response-structure)
- [Data Models](#data-models)
- [How It Works](#how-it-works-high-level)
- [Testing](#testing)
- [License](#license)

---

## Stack and Dependencies

**Core Framework:**
- **Node.js 18+** (Alpine) – Lightweight production runtime
- **Express 4.18.2** – Fast, minimalist web framework with ES Modules support

**Database & ORM:**
- **PostgreSQL 15** – Relational database for audit logs
- **Sequelize 6.35.0** – Promise-based ORM with auto-sync
- **pg 8.11.3 + pg-hstore 2.3.4** – PostgreSQL adapter and data serialization

**HTTP Client & Integration:**
- **axios 1.6.0** – HTTP client for OP Adapter communication
- **cors 2.8.5** – Dependency present, CORS is handled by API Gateway (core-service does not enable CORS)

**Logging:**
- **winston 3.19.0** – Structured logging with multiple transports
- **winston-daily-rotate-file 5.0.0** – Automatic log rotation (daily app/error logs)

**Development & Testing:**
- **nodemon 3.0.1** – Auto-reload during development
- **jest 30.2.0** – Test runner with ES Modules support
- **supertest 7.2.2** – HTTP assertions for integration testing
- **cross-env 10.1.0** – Cross-platform environment variables

## Environment and Configuration

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `DB_HOST` | PostgreSQL hostname | `postgres` (Docker network) |
| `POSTGRES_USER` | PostgreSQL username | `admin` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `tajne_haslo_postgres` |
| `POSTGRES_DB` | Database name | `core_db` |
| `OP_ADAPTER_URL` | OP Adapter service address | `http://op-adapter:3000` |
| `OP_ADAPTER_TIMEOUT` | OP Adapter request timeout (ms) | `30000` |
| `PORT` | Application port (container) | `3000` |

**Database Configuration:**
- Auto-syncs schema on startup using Sequelize `sync({ alter: true })`
- Creates AuditLog table if not exists
- See [src/app.js](src/app.js) for initialization logic

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure PostgreSQL:
   - Ensure PostgreSQL is running on `localhost:5432`
   - Create database: `core_db`
   - Configure credentials via environment variables

3. Set environment variables:
   ```bash
   export DB_HOST=localhost
   export POSTGRES_USER=admin
   export POSTGRES_PASSWORD=tajne_haslo_postgres
   export POSTGRES_DB=core_db
   export OP_ADAPTER_URL=http://localhost:3000
   ```

4. Start the service:
   ```bash
   npm start         # Production mode
   npm run dev       # Development mode with nodemon
   ```

5. Run tests:
   ```bash
   npm test
   ```

## Docker Compose Setup

From project root directory:
```bash
docker compose up --build core-service
```

- Service is internal by default (no host port exposed). Uncomment the `ports` section in `docker-compose.yml` to expose it.
- Database automatically syncs schema on startup
- Logs stored in `logs/` directory with daily rotation

## Architecture

**Composition Root:**
- `Application` class in [src/app.js](src/app.js) wires dependencies and initializes the DB
- Dependencies: `OpAdapterClient` → `SanctionsCheckService` → `SanctionsController`

**Layered Architecture:**
- API controllers: request/response handling
- Application services: business logic
- Repositories: persistence (Sequelize)
- Domain entities: audit log mapping and enrichment

**Key Components:**
- Controllers: [src/api/controllers/](src/api/controllers/)
- Services: [src/application/services/](src/application/services/)
- Clients: [src/infrastructure/clients/](src/infrastructure/clients/)
- Models: [src/infrastructure/database/sequelize/models/](src/infrastructure/database/sequelize/models/)
- Repositories: [src/infrastructure/database/sequelize/repositories/](src/infrastructure/database/sequelize/repositories/)
- Validators: [src/api/validators/](src/api/validators/)

## Endpoints

### Service Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/health` | ❌ No | Returns service status and PostgreSQL connection state |

### Sanctions & Audit Endpoints

All sanctions endpoints require **organization context** via `x-org-id` header (injected by API Gateway after JWT or API Key authentication).

| Method | Endpoint | Auth Required | Description | Required Headers | Query Parameters |
|--------|----------|---------------|-------------|------------------|------------------|
| GET | `/check` | ✅ Yes (org context) | Check entity against sanctions/PEP lists; creates audit log | `x-org-id` (required)<br>`x-user-id` (optional)<br>`x-user-name` (optional)<br>`x-user-email` (optional)<br>`x-request-id` (optional) | `name` (required)<br>`limit` (optional)<br>`fuzzy` (optional)<br>`schema` (optional)<br>`country` (optional) |
| GET | `/history` | ✅ Yes (org context or superadmin) | Retrieve paginated audit logs with filtering | `x-org-id` (required for non-superadmin)<br>`x-role` (optional, for superadmin) | `page` (default: 1)<br>`limit` (default: 20)<br>`search` (text filter)<br>`hasHit` (true/false)<br>`startDate` (ISO date)<br>`endDate` (ISO date)<br>`userId` (filter by user)<br>`orgId` (superadmin only) |
| GET | `/stats` | ✅ Yes (org context) | Get aggregated statistics for organization | `x-org-id` (required) | None |

### Endpoint Details

#### `/check` - Sanctions Check
**Purpose:** Validate entity against OpenSanctions data (via OP Adapter), log to audit trail, return results.

**Headers:**
- `x-org-id` (required) - Organization context for data isolation
- `x-user-id` (optional) - User ID from JWT; defaults to `API` if absent
- `x-user-name` (optional) - User name from JWT; defaults to `User` when userId present
- `x-user-email` (optional) - User email from JWT
- `x-request-id` (optional) - Request tracking ID; auto-generated if missing

**Response:**
- Response is forwarded from OP Adapter (`hits_count`, `data`, and any extra fields returned by the adapter).

**Audit Logging:**
- Creates AuditLog record with organizationId, userId, userName, userEmail, searchQuery, hasHit, hitsCount
- Enriches best match: entityName, entityScore, entityBirthDate, entityGender, entityCountries, entityDatasets, entityDescription, hitDetails, isSanctioned, isPep

**Error Responses:**
- 400 - Missing `name` parameter or empty after trim
- 403 - Missing `x-org-id` header (organization context required)
- 502 - OP Adapter error (`Validation failed downstream`)
- 500 - Internal server error

#### `/history` - Audit Log History
**Purpose:** Retrieve paginated audit logs with filtering; supports organization-scoped access and superadmin queries.

**Data Isolation:**
- Regular users: see only their organization's logs (via `x-org-id`)
- Superadmins: can view all logs or filter by `orgId` parameter

**Error Responses:**
- 403 - Missing `x-org-id` for non-superadmin users (`Unauthorized`)
- 500 - Database error

#### `/stats` - Organization Statistics
**Purpose:** Get aggregated statistics for organization: total checks, sanction hits, PEP hits, and recent logs.

**Response:**
- `recentLogs` includes only: `id`, `searchQuery`, `isSanctioned`, `isPep`, `createdAt`

**Error Responses:**
- 400 - Missing `x-org-id` header (`Missing organization ID`)
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
  -H "x-user-name: John Doe" \
  -H "x-user-email: user@example.com"
```

### Sanctions Check with API Key

**Request:**
```bash
curl -X GET "http://localhost:3000/check?name=Jane%20Smith" \
  -H "x-org-id: <ORG_ID>"
```

Note: For API Key authentication, `userId` is stored as `API` and `userName` defaults to `API`.

### Get Audit History

**Request (Paginated, page 1, 20 items per page):**
```bash
curl -X GET http://localhost:3000/history \
  -H "x-org-id: <ORG_ID>"
```

### Filter History by Date Range

**Request:**
```bash
curl -X GET "http://localhost:3000/history?startDate=2026-01-01T00:00:00Z&endDate=2026-01-31T23:59:59Z" \
  -H "x-org-id: <ORG_ID>"
```

### Get Organization Statistics

**Request:**
```bash
curl -X GET http://localhost:3000/stats \
  -H "x-org-id: <ORG_ID>"
```

---

## Response Structure

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
  ]
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
      "userName": "API",
      "userEmail": null,
      "searchQuery": "Putin",
      "hasHit": true,
      "hitsCount": 1,
      "entityName": "Vladimir Putin",
      "entityScore": 1,
      "entityBirthDate": "1952-10-07",
      "entityCountries": "RU",
      "entityDatasets": "ofac",
      "entityDescription": "Subject to sanctions",
      "hitDetails": { "topics": ["sanction"] },
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
{ "error": "Missing name parameter" }
```

```json
{ "error": "Missing Organization Context (x-org-id)" }
```

```json
{ "error": "Unauthorized" }
```

```json
{ "error": "Missing organization ID" }
```

```json
{ "error": "Validation failed downstream" }
```

```json
{ "error": "Internal Server Error" }
```

---

## Data Models

**AuditLog** ([src/infrastructure/database/sequelize/models/AuditLogModel.js](src/infrastructure/database/sequelize/models/AuditLogModel.js))
```javascript
{
  id: UUID (primary key, auto-generated),
  organizationId: STRING (required),
  userId: STRING (optional),
  userName: STRING (optional),
  userEmail: STRING (optional),
  searchQuery: STRING (required),
  hasHit: BOOLEAN,
  hitsCount: INTEGER,

  entityName: STRING,
  entityScore: FLOAT,
  entityBirthDate: STRING,
  entityGender: STRING,
  entityCountries: TEXT,
  entityDatasets: TEXT,
  entityDescription: TEXT,
  hitDetails: JSONB,
  isSanctioned: BOOLEAN,
  isPep: BOOLEAN,

  createdAt: DATE
}
```

---

## How It Works (High Level)

### Request Flow
1. Client sends `GET /check?name=<entity>` with `x-org-id` header
2. Core Service validates `name` and org context
3. OP Adapter call via `OpAdapterClient`
4. Audit log is created (failure to save does not fail the request)
5. Response is returned to client (adapter payload)

### Audit Logging
- Each search stores organization ID, user context, search query, hit status
- Best match enrichment uses adapter properties or direct fields
- `hitDetails` stores the adapter properties (or full hit if no properties)

### Statistics Aggregation
- `/stats` queries organization-scoped counts
- Recent logs limited to 100 entries with summary fields

### Pagination and Filtering
- `/history` supports `page`, `limit`, `search`, `hasHit`, `userId`, `startDate`, `endDate`
- Superadmin can filter by `orgId` without `x-org-id`

### Database Sync
- Sequelize auto-syncs schema on startup: `sync({ alter: true })`
- Creates AuditLog table if missing

---

## Testing

Integration tests verify endpoint behavior, validation, data isolation, error handling, and OP Adapter/database interactions.

**Test Framework:**
- **jest 30.2.0** – Test runner with ES Modules support
- **supertest 7.2.2** – HTTP assertions
- **Mocking**: OpAdapterClient, AuditLogModel, logger, SequelizeConnection

**Test Files:**
- [tests/check.test.js](tests/check.test.js)
- [tests/history.test.js](tests/history.test.js)
- [tests/stats.test.js](tests/stats.test.js)
- [tests/health.test.js](tests/health.test.js)

**Running Tests:**
```bash
npm test
```

**Notes:**
- Tests run with mocked dependencies (no real DB or adapter).
- `NODE_ENV=test` prevents server startup.

---

## License

MIT
