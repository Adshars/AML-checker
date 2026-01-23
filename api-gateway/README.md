API Gateway
===========

Central reverse proxy and authentication gateway for the AML Checker platform. Routes requests to microservices (Auth Service, Core Service), enforces authentication on protected routes via JWT tokens or API keys, and forwards authentication context (organization ID, user ID, auth type) to downstream services.

Stack and Dependencies
- Node.js 18, Express 5, ES Modules
- http-proxy-middleware (request routing and proxying)
- jsonwebtoken (JWT token verification)
- axios (HTTP client for validation requests)
- node-cache (in-memory caching for API key validation; 60s TTL)
- cors (cross-origin request handling), dotenv
- swagger-ui-express + yamljs (serves OpenAPI docs at /api-docs)
- winston + winston-daily-rotate-file (structured logging with file rotation)
- express-rate-limit (request rate limiting per IP)
- jest + supertest (dev dependencies for E2E testing)
- nock (dev dependency for mocking HTTP requests)
- cross-env (dev dependency for cross-platform environment variables)

Environment and Configuration
- `AUTH_SERVICE_URL` – address of Auth Service; defaults to `http://auth-service:3000` in Docker network.
- `CORE_SERVICE_URL` – address of Core Service; defaults to `http://core-service:3000` in Docker network.
- `JWT_SECRET` – secret key for JWT token verification (must match Auth Service's `JWT_SECRET` for valid token verification).
- Application port in container: 8080; mapped via `PORT` variable (default 8080).

Rate Limiting
- **Auth Endpoints Rate Limit**: 10 requests per 15 minutes per IP address. Applies to all authentication routes: `/auth/login`, `/auth/register-organization`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/refresh`, `/auth/logout`.
- **Protected Auth Endpoints**: `/auth/register-user`, `/auth/reset-secret` (require authentication + rate limiting).
- **API Endpoints Rate Limit**: 100 requests per 15 minutes per IP address. Applies to protected API routes: `/sanctions/*`.
- Rate limit status is returned in response headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`).
- When limit is exceeded, the gateway returns `429 Too Many Requests` error with message: `"Too many requests from this IP, please try again later."`

Local Setup
1) `npm install`
2) `node src/index.js` (optionally set service URLs and `JWT_SECRET` environment variables)
3) `npm test` (for running E2E tests)

Docker Compose Setup
- From project root directory: `docker compose up --build api-gateway`
- Gateway will be available at http://localhost:8080
- OpenAPI docs available at http://localhost:8080/api-docs

Architecture
- **Class-Based Design**: `GatewayServer` class encapsulates all gateway logic (middleware, rate limiters, proxies, route setup).
- **AuthMiddleware**: Standalone class that validates JWT tokens and API Key credentials. Uses node-cache for 60-second TTL caching of API key validation results (60x performance improvement).
- **Route Security**: Protected routes (like `/auth/register-user`) are defined **before** public wildcard routes to ensure Express matches them first.
- **Header Forwarding**: Authentication context (`x-org-id`, `x-user-id`, `x-role`) is extracted by AuthMiddleware and forwarded to downstream services via proxy `onProxyReq` callbacks.
- **Defense in Depth**: Protected endpoints require authentication at gateway level + additional validation at service level (e.g., role checks).

Endpoints
- `GET /health` – returns gateway status (`{ service, status }`).
- `GET /api-docs` – Swagger UI for the gateway's OpenAPI spec.
- `ALL /auth/*` – proxied to Auth Service (explicit routes configured)
	- **Public routes** (no auth required): `/auth/register-organization`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/refresh`, `/auth/logout`.
	- **Protected routes** (requires authentication): `/auth/register-user` (admin only), `/auth/reset-secret` (admin only).
- `ALL /sanctions/*` – proxied to Core Service (requires authentication)
	- Requires valid JWT token or API Key + API Secret.
	- Authenticated requests include `x-org-id`, `x-user-id`, `x-auth-type`, and `x-role` headers.
	- Available endpoints: `/sanctions/check`, `/sanctions/history`.

Authentication Middleware
The gateway validates two authentication scenarios and caches API key validation results for performance:

1. **API Key Authentication** (System-to-System)
	- Headers: `x-api-key`, `x-api-secret`
	- **Caching**: Results cached for 60 seconds using node-cache (in-memory store)
	- Cache hit: validates credential exists and is valid without calling Auth Service
	- Cache miss: calls Auth Service `/auth/internal/validate-api-key` endpoint (2000ms timeout)
	- On success: sets `x-org-id` and `x-auth-type: api-key` headers. User ID and role are not available for API Key auth.

2. **JWT Authentication** (User Login)
	- Header: `Authorization: Bearer <token>`
	- Verifies JWT signature locally using `JWT_SECRET` (no external call, instant validation)
	- On success: sets `x-org-id`, `x-user-id` (if present), `x-auth-type: jwt`, and `x-role` headers.

Headers Forwarding to Downstream Services
- When proxying requests, the gateway forwards `x-request-id`, `x-org-id`, `x-user-id`, `x-auth-type`, and `x-role` headers to downstream services for authorization, auditing, and request tracking.

If neither authentication method is valid, returns 401/403 error.

Usage Examples
- Health check:
```bash
curl http://localhost:8080/health
```

- Organization registration (via gateway):
```bash
curl -X POST http://localhost:8080/auth/register-organization \
	-H "Content-Type: application/json" \
	-d '{
		"orgName": "ACME Corp",
		"country": "PL",
		"city": "Warsaw",
		"address": "Prosta 1",
		"email": "admin@acme.test",
		"password": "Str0ngPass!",
		"firstName": "John",
		"lastName": "Smith"
	}'
```

- User login (via gateway):
```bash
curl -X POST http://localhost:8080/auth/login \
	-H "Content-Type: application/json" \
	-d '{
		"email": "admin@acme.test",
		"password": "Str0ngPass!"
	}'
```

- User registration (via gateway) - **REQUIRES ADMIN AUTHENTICATION**:
```bash
curl -X POST http://localhost:8080/auth/register-user \
	-H "Authorization: Bearer <ADMIN_TOKEN>" \
	-H "Content-Type: application/json" \
	-d '{
		"email": "user@acme.test",
		"password": "Str0ngPass!",
		"firstName": "Jane",
		"lastName": "Doe",
		"organizationId": "<ORG_ID>"
	}'
```

- User logout (via gateway):
```bash
curl -X POST http://localhost:8080/auth/logout \
	-H "Content-Type: application/json" \
	-d '{
		"refreshToken": "<REFRESH_TOKEN>"
	}'
```

- Request to protected endpoint with JWT:
```bash
curl -X GET http://localhost:8080/sanctions/check \
	-H "Authorization: Bearer <JWT_TOKEN>" \
	-H "Content-Type: application/json"
```

- Request to protected endpoint with API Key:
```bash
curl -X GET http://localhost:8080/sanctions/check \
	-H "x-api-key: <API_KEY>" \
	-H "x-api-secret: <API_SECRET>" \
	-H "Content-Type: application/json"
```

Response Structure
- `/health`:
```json
{ "service": "api-gateway", "status": "UP" }
```

- Protected endpoint request (example):
	- Request forwarded with additional headers: `x-org-id`, `x-user-id`, `x-auth-type`
	- Response returned from upstream service

Error Responses
- `401 Unauthorized` – No authentication provided.
- `403 Forbidden` – Invalid or expired JWT token; invalid API Key/Secret.
- `429 Too Many Requests` – Rate limit exceeded for the IP address.
- `500 Internal Server Error` – Authentication middleware or upstream service error.

How It Works (High Level)
- **Request Flow**: Client request arrives → gateway generates `x-request-id` and logs request details → rate limiting middleware checks request quota for IP → authentication middleware validates credentials (API Key or JWT) → validated request forwarded to downstream service with auth context headers (`x-request-id`, `x-org-id`, `x-user-id`, `x-auth-type`, `x-role`) → response returned to client.
- **Rate Limiting**: The gateway uses `express-rate-limit` middleware to enforce per-IP request limits. Authentication routes are limited to 10 requests per 15 minutes, while protected API routes are limited to 100 requests per 15 minutes. Rate limit information is included in response headers.
- **API Docs**: Swagger UI served at `/api-docs`, loaded from `swagger.yaml`.
- **Public Routes** (`/auth/*`): No authentication required; direct proxy to Auth Service for registration, login, and other public endpoints.
- **Protected Routes** (`/auth/reset-secret`, `/sanctions/*`): Authentication middleware validates JWT token or API Key/Secret before proxying request; downstream service receives auth context for authorization.
- **API Key Validation**: Gateway calls Auth Service `/auth/internal/validate-api-key` endpoint to verify credentials and retrieve organization ID.
- **JWT Verification**: Gateway verifies JWT signature locally using `JWT_SECRET` and extracts user, organization, and role information from token payload.
- **Header Forwarding**: Downstream services receive `x-request-id`, `x-org-id`, `x-user-id`, `x-auth-type`, and `x-role` headers for access control, audit logging, and request tracing.
- **Logging**: All requests are logged with structured logging (winston) including method, URL, request ID, and client IP.

Testing
-------

End-to-End (E2E) tests for API Gateway verify routing to microservices, rate limiting enforcement, and authentication context forwarding. Tests use Jest with Supertest for HTTP testing and nock for mocking upstream service responses.

Test Files
- `tests/gateway.test.js` – comprehensive E2E tests for gateway infrastructure.
	- **Rate Limiting (Auth & API)**:
		- Tests verify that `/auth/*` endpoints are rate-limited to 10 requests per 15 minutes per IP.
		- Tests verify that `/sanctions/*` endpoints are rate-limited to 100 requests per 15 minutes per IP.
		- 101st request after limit is reached returns 429 Too Many Requests.
	- **Request Routing**:
		- Tests verify that `/auth/*` requests are correctly proxied to Auth Service.
		- Tests verify that `/sanctions/*` requests are correctly proxied to Core Service.
		- Mock responses from upstream services are validated.
	- **Authentication Context**:
		- Tests use JWT tokens to verify that authenticated requests include `x-org-id`, `x-user-id`, and `x-role` headers forwarded to downstream services.
	- Mocks: nock (HTTP request interception and mocking).

Running Tests
- Command: `npm test` (runs all E2E tests with verbose output)
- Uses Jest with ES Modules support (`cross-env NODE_OPTIONS=--experimental-vm-modules jest --verbose`)
- Tests run in isolated environment with mocked upstream services (no real Auth/Core Service connection required)
- Environment: `NODE_ENV=test` prevents server startup; supertest provides HTTP client without requiring listening port

Test Coverage
- **Infrastructure**: Tests verify correct routing of requests to upstream services based on URL path.
- **Rate Limiting**: Tests ensure rate limits are enforced per IP address for both auth and API endpoints.
- **Request/Response**: Tests validate that requests are proxied correctly and upstream responses are returned to client.
- **Headers**: Tests verify that authentication context headers are forwarded to downstream services.

Example Test Execution
```bash
npm test
```

Expected output:
```
PASS  tests/gateway.test.js
  API Gateway E2E
    ✓ Rate limiting: 101st request to /sanctions returns 429
    ✓ Routing: /auth/login is proxied to Auth Service
    ✓ Routing: /sanctions/* is proxied to Core Service

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

