OP-Adapter
==========

Lightweight HTTP adapter over the local OpenSanctions (Yente) API. Exposes a single entry point to check sanctions/PEP status, maps Yente responses into a simplified format, and provides a health endpoint. Used by core-service to query sanctions data.

**Version:** 1.0.0  
**Node.js:** 18+  
**Type:** ES Modules

## Table of Contents

- [Stack](#stack)
- [Environment](#environment)
- [Local Setup](#local-setup)
- [Docker Setup](#docker-setup)
- [Project Structure](#project-structure)
- [Endpoints](#endpoints)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [How It Works](#how-it-works)
- [Testing](#testing)
- [License](#license)

---

## Stack

- **Node.js 18+** with ES Modules
- **Express 5.2.1**
- **axios 1.13.2** + **axios-retry 4.0.0** (3 retries with exponential backoff)
- **winston 3.19.0** + **winston-daily-rotate-file 5.0.0**
- **jest 30.2.0** + **supertest 7.2.2** for tests

## Environment

| Variable | Description | Default |
|----------|-------------|---------|
| `YENTE_API_URL` | Base URL of Yente API | `http://localhost:8000` |
| `NODE_ENV` | Environment mode | `development` |

Notes:
- Service listens on port `3000` (hardcoded in [src/index.js](src/index.js)).
- Timeout per Yente request: `5000ms`.
- Default limit is `15`, clamped to `1..100`.
- Request ID is taken from `x-request-id` or auto-generated as `req-{timestamp}-{random}`.

## Local Setup

```bash
npm install
npm start
```

Run tests:
```bash
npm test
```

## Docker Setup

Dockerfile uses `node:18-alpine` and runs `node src/index.js`. Map port `3000` as needed in your compose file.

## Project Structure

```
op-adapter/
├── src/
│   ├── index.js                     # Server start (port 3000)
│   ├── app.js                       # Express app + DI
│   ├── application/
│   │   └── dtos/
│   │       ├── requests/            # Request DTOs (validation)
│   │       └── responses/           # Response DTOs
│   ├── clients/
│   │   └── YenteClient.js           # axios + retry
│   ├── controllers/
│   │   └── SanctionsController.js   # /health, /check
│   ├── models/
│   │   └── SanctionEntity.dto.js    # Mapping Yente -> API output
│   ├── services/
│   │   └── SanctionsService.js      # Business logic
│   └── utils/
│       └── logger.js                # Winston logger
├── tests/
│   └── adapter.test.js              # Integration tests
├── Dockerfile
├── package.json
└── README.md
```

## Endpoints

Base URL: `http://localhost:3000`

### `GET /health`

Returns service status.

```json
{
  "status": "UP",
  "service": "op-adapter",
  "mode": "ES Modules + Retry"
}
```

### `GET /check`

Query parameters:
- `name` (required, trimmed)
- `limit` (optional, default 15, clamped 1..100)
- `fuzzy` (optional, string or boolean; only "true" yields true)
- `schema` (optional)
- `country` (optional, mapped to Yente `countries`)

Optional header:
- `x-request-id` for request tracking

Yente request shape:
- `GET /search/default?q={name}&limit={limit}&fuzzy={fuzzy}&schema={schema}&countries={country}`

## Response Format

Successful response includes metadata, the normalized search parameters, hit count, and mapped data.

```json
{
  "meta": {
    "source": "OpenSanctions (Yente)",
    "timestamp": "2026-02-14T10:30:45.123Z",
    "requestId": "req-1735386645123-a1b2c3d4"
  },
  "query": "John Doe",
  "search_params": {
    "limit": 15,
    "fuzzy": false,
    "schema": null,
    "country": null
  },
  "hits_count": 1,
  "data": [
    {
      "id": "ocbid-...",
      "caption": "John Doe",
      "name": "John Doe",
      "schema": "Person",
      "score": 0.98,
      "isSanctioned": true,
      "isPep": false,
      "birthDate": "1970-01-01",
      "country": ["US"],
      "datasets": ["ofac"],
      "properties": {
        "topics": ["sanction"],
        "name": ["John Doe"]
      }
    }
  ]
}
```

Notes:
- `properties` preserves raw Yente properties for downstream consumers.
- Top-level fields are limited to the DTO in [src/models/SanctionEntity.dto.js](src/models/SanctionEntity.dto.js).

## Error Handling

- 400 when `name` is missing or empty:
```json
{ "error": "Missing name parameter" }
```

- 502 when Yente is unavailable after retries:
```json
{ "error": "Sanctions Service Unavailable" }
```

In `NODE_ENV=development`, the 502 response includes a `details` field with the upstream error message.

- 500 on unexpected errors:
```json
{ "error": "Internal Server Error" }
```

## How It Works

1. `CheckSanctionsRequestDto` validates and normalizes query parameters.
2. `SanctionsService` calls `YenteClient.search()` with retry enabled.
3. Results map through `SanctionEntity.fromYenteResponse()`.
4. `CheckSanctionsResponseDto` formats the final response.
5. Logs are written to console and rotated files in `logs/`.

## Testing

Integration tests in [tests/adapter.test.js](tests/adapter.test.js) cover DTO mapping, parameter normalization, error handling, and response structure.

Run:
```bash
npm test
```

## License

ISC
