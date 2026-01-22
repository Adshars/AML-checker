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
- `GET /health` – returns service status and PostgreSQL connection state (`{ service, status, database }`).
	- No authentication required; available for health checks and liveness probes.
- `GET /check` – sanctions checking endpoint (protected; requires organization context).
	- Query parameters: `name` (required); optional: `limit`, `fuzzy`, `schema`, `country` (forwarded to OP Adapter).
	- Headers required: `x-org-id` (organization context; enforced by API Gateway middleware).
	- Optional headers: `x-user-id` (user context from JWT; if absent, defaults to `API` in audit log), `x-request-id` (request tracking ID; auto-generated if missing).
	- Returns: OP Adapter response with `hits_count`, `data` array of mapped entities, and `meta` passthrough.
	- Automatically creates AuditLog record with search query, hit flag/count, and best-match enrichment (name, score, birthDate, countries, datasets, description/notes, isPep, isSanctioned).
	- Error responses: 400 (missing name), 403 (missing x-org-id), 502 (OP Adapter error), 500 (unexpected).
- `GET /history` – returns paginated audit log (protected; requires organization context or superadmin role).
	- Query parameters (optional): `page`, `limit`, `search`, `hasHit`, `startDate`, `endDate`, `userId`; `orgId` allowed only with `x-role: superadmin`.
	- Headers required: `x-org-id` (unless `x-role: superadmin`).
	- Optional header: `x-role` (if `superadmin`, can access without `x-org-id` and filter by organization).
	- Returns: `{ data, meta { totalItems, totalPages, currentPage, itemsPerPage } }` ordered by `createdAt` descending.
	- Data isolation: regular users see only their organization's logs; superadmins can view all logs or filter by `orgId`.
	- Error responses: 403 (missing org context for non-superadmin), 500 (database error).

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

How It Works (High Level)
- **Request Flow**: Client sends `GET /check?name=<entity>` with organization context in header → Core Service validates `name` and `x-org-id` → forwards to OP Adapter via `OpAdapterClient` → receives sanctions result with `hits_count` and `data` → creates AuditLog record (organization-scoped) → returns adapter payload.
- **Audit Logging**: Each search stores organization ID, user ID (`API` default), search query, hit flag/count, and best-match enrichment (name, score, birthDate, gender, countries, datasets, description/notes, isPep, isSanctioned). Supports compliance and search history per org.
- **Pagination and Filtering**: `/history` supports pagination with filters: text search by entity name, hit status, date range, user ID, and (superadmin only) organization ID.
- **Data Isolation**: Organization-based access enforced on `/history` via `x-org-id`; `x-role: superadmin` can omit org header and optionally filter by `orgId`.
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

Integration tests verify validation, data isolation, and adapter/database interactions. Jest + Supertest with ESM uses `jest.unstable_mockModule` to mock before imports.

Test Files
- `tests/check.test.js` – `/check` endpoint.
	- Missing `name` → 400; missing `x-org-id` → 403.
	- Happy path persists AuditLog using mocked `OpAdapterClient.checkSanctions` response.
	- Mocks: `OpAdapterClient`, `AuditLog`, `logger`.
- `tests/history.test.js` – `/history` endpoint.
	- Org context required unless `x-role: superadmin`.
	- Pagination metadata and filters (`search`, `hasHit`, `userId`, `startDate`/`endDate`, `orgId` when superadmin).
	- Mocks: `OpAdapterClient` (constructed in app), `AuditLog`, `logger`.

Running Tests
- Command: `npm test` (runs all tests with verbose output)
- Uses ESM via `cross-env NODE_OPTIONS=--experimental-vm-modules jest --verbose`
- Tests run isolated from real DB/adapter; all externals mocked before app import

Test Coverage
- **Request Validation**: Proper status codes for missing `name` / `x-org-id`.
- **Security**: Org-based isolation on `/history`; superadmin exemption via `x-role` header.
- **Business Logic**: Audit log persistence with best-match enrichment and hit counting.
- **Pagination & Filtering**: Metadata calculation and query filters for history results.

Example Test Execution
```bash
npm test
```

Expected output:
```
PASS  tests/check.test.js
  GET /check Integration Test
    ✓ should return 400 if name is missing
    ✓ should return 403 if x-org-id is missing
    ✓ should process successful response from Op-Adapter and save log

PASS  tests/history.test.js
  GET /history Integration Test
    ✓ should return 403 if x-org-id is missing (Security)
    ✓ should return paginated results (Pagination)
    ✓ should enforce data isolation for regular users
    ✓ should allow filtering by search query

Test Suites: 2 passed, 2 total
Tests:       7 passed, 7 total
```