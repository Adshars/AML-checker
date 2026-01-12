Core Service
============

Sanctions checking and audit logging service for the AML Checker platform. Receives sanctioned entity queries via API Gateway, forwards them to the OP Adapter for validation, logs all searches to PostgreSQL audit table, and returns results with hit/match information. Enforces organization-based data isolation through context headers.

Stack and Dependencies
- Node.js 18, Express 4, ES Modules
- Sequelize 6 + PostgreSQL 15 (relational database)
- pg + pg-hstore (PostgreSQL adapter and data type serialization)
- axios (HTTP client for OP Adapter communication)
- cors (cross-origin request handling)
- winston + winston-daily-rotate-file (structured logging with file rotation)
- nodemon (dev dependency for auto-reload)

Environment and Configuration
- `DB_HOST` – PostgreSQL hostname; defaults to `postgres` in Docker network.
- `POSTGRES_USER` – PostgreSQL username; defaults to `admin`.
- `POSTGRES_PASSWORD` – PostgreSQL password; defaults to `tajne_haslo_postgres`.
- `POSTGRES_DB` – database name; defaults to `core_db`.
- `OP_ADAPTER_URL` – address of OP Adapter service; defaults to `http://op-adapter:3000` in Docker network.
- Application port in container: 3000; exposed and mapped via docker-compose.
- Database auto-syncs on startup using Sequelize `sync({ alter: true })`.

Local Setup
1) `npm install`
2) Ensure PostgreSQL is running on `localhost:5432` with credentials from environment variables
3) `npm start` (for production) or `npm run dev` (for development with nodemon)
4) Set environment variables: `DB_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `OP_ADAPTER_URL`

Docker Compose Setup
- From project root directory: `docker compose up --build core-service`
- Service connects to PostgreSQL container automatically via Docker network.
- Endpoints available at http://localhost:3000 (or mapped port from docker-compose).

Endpoints
- `GET /health` – returns service status and PostgreSQL connection state (`{ service, status, database }`).
	- No authentication required; available for health checks and liveness probes.
- `GET /check` – sanctions checking endpoint (protected; requires organization context).
	- Query parameters: `name` (required) – entity name to check against sanctions lists.
	- Headers required: `x-org-id` (organization context; enforced by API Gateway middleware).
	- Optional headers: `x-user-id` (user context from JWT; if absent, defaults to 'B2B-API-KEY' in audit log), `x-request-id` (request tracking ID; auto-generated if missing).
	- Returns: sanctions check result from OP Adapter with `hits_count`, list of matches, and entity details.
	- Automatically creates AuditLog record with search query and result (HIT/CLEAR).
	- Error responses: 400 (missing name), 403 (missing x-org-id), 502 (OP Adapter error).
- `GET /history` – returns paginated audit log for the requesting organization (protected; requires organization context or superadmin role).
	- Query parameters (optional):
		- `page` – page number for pagination (default: 1).
		- `limit` – number of records per page (default: 20).
		- `search` – text filter for searching entity names (case-insensitive).
		- `hasHit` – filter by hit status: `true` or `false` (returns only hits or clear results).
		- `startDate`, `endDate` – ISO 8601 date range filter for search timestamp (e.g., `2025-12-28T00:00:00Z`).
		- `userId` – filter by specific user ID (e.g., 'B2B-API-KEY' for system access).
		- `orgId` – superadmin only; filter by organization ID.
	- Headers required: `x-org-id` (enforced by API Gateway middleware, unless user is superadmin).
	- Optional header: `x-role` (user role; if 'superadmin', can access logs without x-org-id and filter by organization).
	- Returns: paginated array of AuditLog entries with metadata (totalItems, totalPages, currentPage, itemsPerPage), ordered by creation date descending.
	- Data isolation: regular users see only their organization's logs (filtered by `x-org-id`); superadmins see all logs or can filter by `?orgId=<ORG_ID>` query parameter.
	- Error responses: 403 (missing x-org-id and not superadmin), 500 (database error).

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

- Sanctions check (via API Gateway with API Key – user ID defaults to 'B2B-API-KEY'):
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

- Audit history filtered by user ID (e.g., specific user or B2B-API-KEY):
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

- `/check` (success; example from OP Adapter):
```json
{
	"entity_name": "John Doe",
	"hits_count": 2,
	"matches": [
		{
			"list_name": "UN Sanctions List",
			"match_score": 0.95,
			"details": "..."
		},
		{
			"list_name": "EU Consolidated List",
			"match_score": 0.88,
			"details": "..."
		}
	]
}
```

- `/history` (success; example with pagination metadata):
```json
{
	"data": [
		{
			"id": "<uuid>",
			"organizationId": "<org_id>",
			"userId": "<user_id>",
			"searchQuery": "John Doe",
			"hasHit": true,
			"hitsCount": 2,
			"createdAt": "2025-12-28T10:30:00Z"
		},
		{
			"id": "<uuid>",
			"organizationId": "<org_id>",
			"userId": "B2B-API-KEY",
			"searchQuery": "Jane Smith",
			"hasHit": false,
			"hitsCount": 0,
			"createdAt": "2025-12-28T10:25:00Z"
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

How It Works (High Level)
- **Request Flow**: Client sends `GET /check?name=<entity>` with organization context in header → Core Service validates name parameter and `x-org-id` header presence → forwards request to OP Adapter at `/check` endpoint with query name → receives sanctions result with hit count and matches → creates AuditLog record (organization-scoped, audit trail) → returns result to client.
- **Audit Logging**: Every search query is automatically logged to AuditLog table with: organization ID (from header), user ID (from header or 'B2B-API-KEY'), search query, whether hit occurred, and hit count. Enables compliance auditing and search history per organization.
- **Pagination and Filtering**: `/history` endpoint supports pagination (page-based with configurable page size) and multiple filtering options: text search by entity name (case-insensitive), hit status filter, date range filter, user ID filter, and (for superadmins) organization ID filter. Filters can be combined for advanced queries.
- **Data Isolation**: Core Service enforces organization-based access control on `/history` endpoint by filtering AuditLog records using `x-org-id` header for regular users. Superadmin users (identified by `x-role: superadmin` header) can access all organization logs without requiring `x-org-id` header and can optionally filter by organization using `?orgId=<ORG_ID>` query parameter. Regular users can only see their organization's audit logs; no cross-organization data leakage.
- **OP Adapter Integration**: Core Service acts as middleware between API Gateway and OP Adapter, adding audit logging and organization context validation. All validation logic (sanctions list matching) is delegated to OP Adapter.
- **Database Sync**: Sequelize automatically syncs schema on startup (`sync({ alter: true })`), creating AuditLog table if missing and altering schema if needed.

Data Models
- **AuditLog**: 
	- `id` (UUID, primary key)
	- `organizationId` (string, indexed for fast filtering)
	- `userId` (string, optional; 'B2B-API-KEY' for system access)
	- `searchQuery` (string; the entity name queried)
	- `hasHit` (boolean; true if matches found)
	- `hitsCount` (integer; number of sanctions matches)
	- `createdAt` (timestamp; auto-set on record creation)