API Gateway
===========

Central reverse proxy and authentication gateway for the AML Checker platform. Routes requests to microservices (Auth Service, Core Service, OP Adapter), enforces authentication on protected routes via JWT tokens or API keys, and forwards authentication context (organization ID, user ID, auth type) to downstream services.

Stack and Dependencies
- Node.js 18, Express 5, ES Modules
- http-proxy-middleware (request routing and proxying)
- jsonwebtoken (JWT token verification)
- axios (HTTP client for validation requests)
- cors (cross-origin request handling), dotenv
- swagger-ui-express + yamljs (serves OpenAPI docs at /api-docs)
- winston + winston-daily-rotate-file (structured logging with file rotation)

Environment and Configuration
- `AUTH_SERVICE_URL` – address of Auth Service; defaults to `http://auth-service:3000` in Docker network.
- `CORE_SERVICE_URL` – address of Core Service; defaults to `http://core-service:3000` in Docker network.
- `OP_ADAPTER_URL` – address of OP Adapter service; defaults to `http://op-adapter:3000` in Docker network.
- `JWT_SECRET` – secret key for JWT token verification (must match Auth Service's `JWT_SECRET` for valid token verification).
- Application port in container: 8080; mapped via `PORT` variable (default 8080).

Local Setup
1) `npm install`
2) `node src/index.js` (optionally set service URLs and `JWT_SECRET` environment variables)

Docker Compose Setup
- From project root directory: `docker compose up --build api-gateway`
- Gateway will be available at http://localhost:8080
- OpenAPI docs available at http://localhost:8080/api-docs

Endpoints
- `GET /health` – returns gateway status (`{ service, status }`).
- `GET /api-docs` – Swagger UI for the gateway's OpenAPI spec.
- `ALL /auth/*` – proxied to Auth Service
	- Includes `/auth/register-organization`, `/auth/register-user`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/refresh`, `/auth/logout`, and internal validation endpoints.
	- Public routes: `/auth/register-*`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/refresh`.
	- Protected routes: `/auth/reset-secret` (requires authentication).
- `ALL /sanctions/*` – proxied to Core Service (requires authentication)
	- Requires valid JWT token or API Key + API Secret.
	- Authenticated requests include `x-org-id`, `x-user-id` (if available), `x-auth-type`, and `x-role` headers.
	- Available endpoints: `/sanctions/check`, `/sanctions/history`.

Authentication Middleware
The gateway validates two authentication scenarios:

1. **API Key Authentication** (System-to-System)
	- Headers: `x-api-key`, `x-api-secret`
	- Validates credentials with Auth Service `/auth/internal/validate-api-key` endpoint.
	- On success: sets `x-org-id` and `x-auth-type: api-key` headers.

2. **JWT Authentication** (User Login)
	- Header: `Authorization: Bearer <token>`
	- Verifies JWT signature using `JWT_SECRET`.
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
- `500 Internal Server Error` – Authentication middleware or upstream service error.

How It Works (High Level)
- **Request Flow**: Client request arrives → gateway generates `x-request-id` and logs request details → authentication middleware validates credentials (API Key or JWT) → validated request forwarded to downstream service with auth context headers (`x-request-id`, `x-org-id`, `x-user-id`, `x-auth-type`, `x-role`) → response returned to client.
- **API Docs**: Swagger UI served at `/api-docs`, loaded from `swagger.yaml`.
- **Public Routes** (`/auth/*`): No authentication required; direct proxy to Auth Service for registration, login, and other public endpoints.
- **Protected Routes** (`/auth/reset-secret`, `/sanctions/*`): Authentication middleware validates JWT token or API Key/Secret before proxying request; downstream service receives auth context for authorization.
- **API Key Validation**: Gateway calls Auth Service `/auth/internal/validate-api-key` endpoint to verify credentials and retrieve organization ID.
- **JWT Verification**: Gateway verifies JWT signature locally using `JWT_SECRET` and extracts user, organization, and role information from token payload.
- **Header Forwarding**: Downstream services receive `x-request-id`, `x-org-id`, `x-user-id`, `x-auth-type`, and `x-role` headers for access control, audit logging, and request tracing.
- **Logging**: All requests are logged with structured logging (winston) including method, URL, request ID, and client IP.

Limitations and TODO
- No per-route rate limiting.
- No request logging to external systems (only console and file output via Winston).
- No API key rotation or management endpoint.
- No comprehensive error handling for malformed upstream responses.
- Public routes (`/auth/*`) accessible to all; no DDoS protection on registration endpoints.
