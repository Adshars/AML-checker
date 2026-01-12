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
	- Query parameters: `name` (required) – person or entity name to check against sanctions/PEP lists.
	- Optional header: `x-request-id` (request tracking ID; auto-generated if missing and returned in response).
	- No authentication required; called from Core Service which enforces organization context.
	- Delegates to Yente API: `GET /search/default?q=<name>&limit=15&fuzzy=false` with automatic retry (3 attempts, exponential backoff).
	- Returns: simplified response with query metadata, hit count, request ID, and mapped result array.
	- Response fields per result: `id`, `name`, `schema`, `isSanctioned`, `isPep`, `country`, `birthDate`, `notes`, `score`.
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
	"hits_count": 2,
	"data": [
		{
			"id": "ocbid-8f7ac0e8b79e67a42c6de10d8a2c7b3f",
			"name": "John Doe",
			"schema": "Person",
			"isSanctioned": true,
			"isPep": false,
			"country": ["US"],
			"birthDate": ["1970-01-01"],
			"notes": ["U.S. OFAC Sanctions List"],
			"score": 0.98
		},
		{
			"id": "ocbid-7e6ab1d7a68e56b41b5cd9c7a1b6a2e",
			"name": "John Michael Doe",
			"schema": "Person",
			"isSanctioned": false,
			"isPep": true,
			"country": ["GB"],
			"birthDate": ["1975-06-15"],
			"notes": ["PEP - UK Government Official"],
			"score": 0.85
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
- **Request Flow**: Client (Core Service) sends `GET /check?name=<entity>` (optionally with `x-request-id` header) → OP-Adapter validates `name` parameter → forwards to Yente API at `/search/default` with query name, limit=15, fuzzy=false.
- **Retry Mechanism**: OP-Adapter uses axios-retry with automatic retry on network errors and 5xx server errors (max 3 attempts, exponential backoff: 1s → 2s → 4s). Does NOT retry on 4xx errors (invalid request). Logs retry attempts with request details.
- **Response Mapping**: For each Yente result, OP-Adapter extracts: `id`, `caption` (mapped to `name`), `schema` (Person/Company/Organization), and checks `properties.topics` array for sanctioning flags.
- **Sanctioning Flags**: 
	- `isSanctioned`: true if `topics` array contains `'sanction'` (indicating entity is on any OFAC/UN/EU/other sanctions list).
	- `isPep`: true if `topics` array contains `'role.pep'` (Politically Exposed Person status).
- **Simplified Response**: OP-Adapter returns only relevant fields (id, name, schema, flags, country, birthDate, notes, score) plus metadata (source, timestamp, requestId) and hit count for easier downstream consumption.
- **Request Tracking**: If `x-request-id` header is provided, it is preserved and returned in response `meta.requestId` for end-to-end request tracking. If missing, OP-Adapter generates one automatically.
- **Error Handling**: If Yente is unavailable (after all retries) or returns malformed data, OP-Adapter returns 502 error with error message and details.

Yente API Field Mapping
- Yente `id` → OP-Adapter `id`
- Yente `caption` → OP-Adapter `name`
- Yente `schema` → OP-Adapter `schema` (Person, Company, Organization, etc.)
- Yente `properties.topics` → OP-Adapter `isSanctioned`, `isPep` flags
- Yente `properties.country` → OP-Adapter `country` (array of country codes)
- Yente `properties.birthDate` → OP-Adapter `birthDate` (array of dates)
- Yente `properties.notes` → OP-Adapter `notes` (array of note strings)
- Yente `score` → OP-Adapter `score` (relevance/match score 0.0-1.0)

Limitations and TODO
- **No authentication or rate limiting** – OP-Adapter assumes it's called only from Core Service (behind API Gateway auth); direct access is unrestricted.
- **Retry strategy**: Retries up to 3 times on network errors and 5xx responses with exponential backoff (1s, 2s, 4s), but does not retry on client errors (4xx); could add configurable retry count and delay strategy.
- **Fuzzy search disabled** – currently set `fuzzy=false`; can be enabled to handle typos, but may increase false positives.
- **Fixed result limit** – limit hardcoded to 15 results; no pagination or limit parameter exposed.
- **No Yente schema filtering** – searches all entity types (Person, Company, Organization); could add filtering for specific schema types.
- **No response caching** – every check hits Yente directly (even with retries); consider Redis cache for frequently checked names to reduce latency and retry overhead.
- **Limited error details** – 502 response on Yente failure after retries; could provide more granular error information (retry count exhausted, timeout, malformed response, etc.).
- **Score interpretation not documented** – score field returned from Yente but meaning varies; could add clarification or threshold logic.
- **No support for multiple criteria** – only name-based search; cannot filter by country, date range, or other entity properties.
- **Yente service dependency** – if Yente is down, OP-Adapter will retry 3 times then fail; no fallback or degraded mode.