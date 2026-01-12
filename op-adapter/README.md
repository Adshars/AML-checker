OP-Adapter
==========

Lightweight HTTP adapter over the local OpenSanctions (Yente) API. Exposes a single entry point to check sanctions/PEP status for persons and entities, maps Yente responses to a simplified format, and provides health-check endpoint. Acts as a sanctions database query layer for the Core Service.

Stack and Dependencies
- Node.js 18, Express 5.2.1, ES Modules
- axios (^1.13.2) – HTTP client for Yente communication
- axios-retry (^4.0.0) – automatic retry mechanism with exponential backoff for Yente API calls
- winston + winston-daily-rotate-file (^5.0.0) – structured logging with file rotation
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
- **No authentication or rate limiting** – OP-Adapter assumes it's called only from Core Service (behind API Gateway auth); direct access is unrestricted.
- **Retry strategy**: Retries up to 3 times on network errors and 5xx responses with exponential backoff (1s, 2s, 4s), but does not retry on client errors (4xx); could add configurable retry count and delay strategy.
- **No response caching** – every check hits Yente directly (even with retries); consider Redis cache for frequently checked names to reduce latency and retry overhead.
- **Limited error details** – 502 response on Yente failure after retries; could provide more granular error information (retry count exhausted, timeout, malformed response, etc.).
- **Score interpretation not documented** – score field returned from Yente but meaning varies; could add clarification or threshold logic.
- **No support for multiple names** – only single name-based search; cannot check multiple entities in one request.
- **Yente service dependency** – if Yente is down, OP-Adapter will retry 3 times then fail; no fallback or degraded mode.