OP-Adapter
==========

Lightweight HTTP adapter over the local OpenSanctions (Yente) API. Exposes a single entry point to check sanctions/PEP status for a person or entity, maps Yente responses to a simplified format, and provides a health-check.

Stack and Dependencies
- Node.js 18, Express 5, ES Modules
- axios for Yente communication
- Default service port: 3000 (mapped to 3001 in docker-compose)

Environment and Configuration
- `YENTE_API_URL` (optional) points to the base Yente URL; defaults to `http://localhost:8000`.
- In docker-compose it is set to `http://yente:${YENTE_PORT}`.
- No database or additional secrets required.

Local Run
1) `npm install`
2) `npm start`

Docker Compose Run
- From project root: `docker compose up --build op-adapter`
- Endpoints available at http://localhost:3001 (3001:3000 mapping).

Endpoints
- `GET /health` – simple health check: `{ status, service, mode }`.
- `GET /check?name=<string>` – main verification endpoint.
	- Parameter: `name` (required).
	- Delegates to Yente `/search/default` with `limit=15`, `fuzzy=false`.
	- Response array fields: `id`, `name`, `schema`, `isSanctioned`, `isPep`, `country`, `birthDate`, `notes`, `score`, plus meta `source`, `timestamp`, `hits_count`.
	- Error codes: 400 (missing parameter), 502 (Yente unavailable).

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
```json
{
	"meta": {
		"source": "OpenSanctions (Local Yente)",
		"timestamp": "2024-01-01T12:00:00.000Z"
	},
	"query": "John Doe",
	"hits_count": 2,
	"data": [
		{
			"id": "ocbid-123",
			"name": "John Doe",
			"schema": "Person",
			"isSanctioned": false,
			"isPep": true,
			"country": ["US"],
			"birthDate": ["1970-01-01"],
			"notes": [],
			"score": 0.92
		}
	]
}
```

How It Works (High Level)
- `/check` calls Yente with `q=<name>`.
- Yente response is mapped: `isSanctioned` based on `topics` containing `sanction`, `isPep` on `role.pep`.
- Selected properties (country, birthDate, notes) and score are returned for easier client rendering.

Limitations and TODO
- No authentication or rate limiting.
- Fuzzy search disabled (`fuzzy=false`) – can be enabled if needed.
- No pagination; limit fixed at 15.
- Extend returned fields if required.