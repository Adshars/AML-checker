Core Service
============

Sanctions checking and audit logging service for the AML Checker platform. Receives sanctioned entity queries via API Gateway, forwards them to the OP Adapter for validation, logs all searches to PostgreSQL audit table, and returns results with hit/match information. Enforces organization-based data isolation through context headers.

Stack and Dependencies
- Node.js 18, Express 4, ES Modules
- Sequelize 6 + PostgreSQL 15 (relational database)
- axios (HTTP client for OP Adapter communication)
- cors, nodemon (dev dependency)

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
	- Optional header: `x-user-id` (user context from JWT; if absent, defaults to 'B2B-API-KEY' in audit log).
	- Returns: sanctions check result from OP Adapter with `hits_count`, list of matches, and entity details.
	- Automatically creates AuditLog record with search query and result (HIT/CLEAR).
	- Error responses: 400 (missing name), 403 (missing x-org-id), 502 (OP Adapter error).
- `GET /history` – returns audit log for the requesting organization (protected; requires organization context).
	- No query parameters.
	- Headers required: `x-org-id` (enforced by API Gateway middleware).
	- Returns: array of up to 50 most recent AuditLog entries for the organization, ordered by creation date descending.
	- Data isolation: returns only logs for the organization in `x-org-id` header.
	- Error responses: 403 (missing x-org-id), 500 (database error).

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

- Audit history for organization:
```bash
curl -X GET http://localhost:3000/history \
	-H "x-org-id: <ORG_ID>"
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

- `/history` (success; example):
```json
[
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
]
```

How It Works (High Level)
- **Request Flow**: Client sends `GET /check?name=<entity>` with organization context in header → Core Service validates name parameter and `x-org-id` header presence → forwards request to OP Adapter at `/check` endpoint with query name → receives sanctions result with hit count and matches → creates AuditLog record (organization-scoped, audit trail) → returns result to client.
- **Audit Logging**: Every search query is automatically logged to AuditLog table with: organization ID (from header), user ID (from header or 'B2B-API-KEY'), search query, whether hit occurred, and hit count. Enables compliance auditing and search history per organization.
- **Data Isolation**: Core Service enforces organization-based access control on `/history` endpoint by filtering AuditLog records using `x-org-id` header. Users can only see their organization's audit logs; no cross-organization data leakage.
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

Limitations and TODO
- No pagination on `/history` endpoint; always returns last 50 records (should add offset/limit parameters).
- No filtering options on `/history` beyond organization ID (consider adding date range, user filter, hasHit filter).
- No caching of OP Adapter responses; every check hits OP Adapter directly (could reduce latency with Redis cache).
- No error handling for malformed OP Adapter responses (assumes valid JSON structure).
- No rate limiting per organization or per-user; anyone with valid auth can make unlimited checks.
- Audit log retention unbounded; no archival or deletion policy for old logs.
- No soft delete; audit logs are permanent and immutable.
- No compression or batching of duplicate queries (consider adding deduplication logic).
