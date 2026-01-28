API Gateway
===========

Central reverse proxy and authentication gateway for the AML Checker platform. Routes requests to microservices (Auth Service, Core Service), enforces authentication on protected routes via JWT tokens or API keys, and forwards authentication context (organization ID, user ID, auth type, user email) to downstream services.

Stack and Dependencies
- **Node.js 18+, Express 5, ES Modules**
- **http-proxy-middleware** v3.0.5 – request routing and proxying to upstream services
- **jsonwebtoken** v9.0.3 – JWT token verification (local, no external calls)
- **axios** v1.13.2 – HTTP client for API Key validation requests to Auth Service
- **node-cache** v5.1.2 – in-memory caching for API key validation (60s TTL, ~60x performance gain)
- **cors** v2.8.5 – cross-origin request handling
- **dotenv** v17.2.3 – environment variable management
- **swagger-ui-express** v5.0.0 + **yamljs** v0.3.0 – OpenAPI documentation at `/api-docs`
- **winston** v3.19.0 + **winston-daily-rotate-file** v5.0.0 – structured logging with daily rotation
- **express-rate-limit** v8.2.1 – request rate limiting per IP address
- **jest** v30.2.0, **supertest** v7.2.2 (dev) – E2E testing framework
- **nock** v14.0.10 (dev) – HTTP request mocking
- **cross-env** v10.1.0 (dev) – cross-platform environment variables

Environment and Configuration
- `AUTH_SERVICE_URL` – address of Auth Service; defaults to `http://auth-service:3000` in Docker network.
- `CORE_SERVICE_URL` – address of Core Service; defaults to `http://core-service:3000` in Docker network.
- `JWT_SECRET` – secret key for JWT token verification (must match Auth Service's `JWT_SECRET` for valid token verification).
- `PORT` – application port (default 8080).
- `NODE_ENV` – environment (set to `test` during tests to prevent server startup).

Rate Limiting
- **Auth Endpoints**: 20 requests per 15 minutes per IP. Applies to all `/auth/*` routes (login, registration, refresh, etc.).
- **API Endpoints**: 100 requests per 15 minutes per IP. Applies to `/sanctions/*` and `/users/*` routes.
- When limit is exceeded: HTTP 429 response with message "Too many requests from this IP, please try again later."
- Rate limit metadata is returned in response headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.

Local Setup
1) `npm install`
2) `node src/index.js` (optionally set service URLs and `JWT_SECRET` environment variables)
3) `npm test` (for running E2E tests)

Docker Compose Setup
- From project root directory: `docker compose up --build api-gateway`
- Gateway will be available at http://localhost:8080
- OpenAPI docs available at http://localhost:8080/api-docs

Architecture
- **Class-Based Design**: `GatewayServer` class (src/GatewayServer.js) encapsulates all gateway logic: global middleware, rate limiters, proxy setup, and route configuration.
- **AuthMiddleware Class**: Standalone (src/authMiddleware.js) validates JWT tokens and API Key credentials with automatic in-memory caching.
- **Route Configuration**: Routes defined in src/config/routes.js (currently used for reference; route setup is in GatewayServer.setupRoutes()).
- **Protected Routes Order**: Protected routes are registered **before** their wildcard counterparts to ensure Express matches specific routes first (e.g., `/auth/register-user` before `/auth/*`).
- **Proxy Middleware**: Uses http-proxy-middleware with custom onProxyReq callbacks to inject authentication headers (`x-org-id`, `x-user-id`, `x-auth-type`, `x-role`) into upstream requests.
- **API Key Caching**: Gateway caches successful API Key validations for 60 seconds in-memory using node-cache, reducing Auth Service calls by ~60x.
- **Request Tracking**: Each request receives a unique `x-request-id` for end-to-end request tracing and audit logging.
- **Logging**: Structured logging via Winston with daily rotating files (logs folder), console output, separate error logs.

Endpoints
-------------

### Gateway Endpoints

| Method | Endpoint | Auth Required | Rate Limit | Description |
|--------|----------|---------------|------------|-------------|
| GET | `/health` | ❌ No | None | Returns gateway status: `{ service: "api-gateway", status: "UP" }` |
| GET | `/api-docs` | ❌ No | None | Swagger UI for OpenAPI specification (swagger.yaml) |

### Auth Service Proxy (PUBLIC Routes)

All public routes are rate limited to **20 requests per 15 minutes per IP**.

| Method | Endpoint | Auth Required | Proxied To | Description |
|--------|----------|---------------|------------|-------------|
| POST | `/auth/register-organization` | ❌ No | Auth Service | Register new organization with admin user |
| POST | `/auth/login` | ❌ No | Auth Service | User login (returns JWT access token + refresh token) |
| POST | `/auth/forgot-password` | ❌ No | Auth Service | Request password reset email with token |
| POST | `/auth/reset-password` | ❌ No | Auth Service | Reset password using token from email |
| POST | `/auth/refresh` | ❌ No | Auth Service | Refresh JWT access token using refresh token |
| POST | `/auth/logout` | ❌ No | Auth Service | Logout and revoke refresh token from database |

### Auth Service Proxy (PROTECTED Routes)

All protected routes require **JWT authentication** and are rate limited to **20 requests per 15 minutes per IP**.

| Method | Endpoint | Auth Required | Role Required | Proxied To | Description |
|--------|----------|---------------|---------------|------------|-------------|
| POST | `/auth/register-user` | ✅ JWT | admin/superadmin | Auth Service | Register new user in organization |
| POST | `/auth/reset-secret` | ✅ JWT | admin/superadmin | Auth Service | Reset organization's API secret |
| POST | `/auth/change-password` | ✅ JWT | - | Auth Service | Change user's password (requires current password) |
| GET | `/auth/organization/keys` | ✅ JWT | - | Auth Service | Get organization's public API key |

### Sanctions Service Proxy (Core Service)

All sanctions routes require **JWT or API Key authentication** and are rate limited to **100 requests per 15 minutes per IP**.

| Method | Endpoint | Auth Required | Proxied To | Description | Query Parameters |
|--------|----------|---------------|------------|-------------|-----------------|
| GET | `/sanctions/check` | ✅ JWT or API Key | Core Service | Check entity against sanctions/PEP lists | `name` (required), `limit`, `fuzzy`, `schema`, `country` |
| GET | `/sanctions/history` | ✅ JWT or API Key | Core Service | Retrieve audit logs with pagination and filtering | `page`, `limit`, `search`, `hasHit`, `startDate`, `endDate`, `userId`, `orgId` |
| GET | `/sanctions/stats` | ✅ JWT or API Key | Core Service | Get aggregated statistics for organization | - |
| GET | `/sanctions/health` | ❌ No | Core Service | Health check for Core Service | - |

### Users Management Proxy (Auth Service)

All users management routes require **JWT authentication (admin/superadmin roles)** and are rate limited to **100 requests per 15 minutes per IP**.

| Method | Endpoint | Auth Required | Role Required | Proxied To | Description |
|--------|----------|---------------|---------------|------------|-------------|
| GET | `/users` | ✅ JWT | admin/superadmin | Auth Service | List all users in organization |
| POST | `/users` | ✅ JWT | admin/superadmin | Auth Service | Create new user in organization |
| DELETE | `/users/:id` | ✅ JWT | admin/superadmin | Auth Service | Delete user from organization (prevents self-deletion) |

### Context Headers (Injected by Gateway)

After successful authentication, the gateway automatically injects these headers into all proxied requests:

| Header | Source | Description |
|--------|--------|-------------|
| `x-request-id` | Gateway | Unique request identifier for end-to-end tracing |
| `x-org-id` | JWT payload or API Key validation | Organization ID (UUID) |
| `x-user-id` | JWT payload | User ID (UUID) - not present for API Key auth |
| `x-user-email` | JWT payload | User email or `"api@system"` for API Key auth |
| `x-auth-type` | Gateway | Authentication method: `"jwt"` or `"api-key"` |
| `x-role` | JWT payload | User role: `"superadmin"`, `"admin"`, or `"user"` - not present for API Key auth |

Authentication Middleware
The AuthMiddleware (src/authMiddleware.js) validates two authentication scenarios with automatic caching:

**1. API Key Authentication** (System-to-System):
- Headers: `x-api-key`, `x-api-secret`
- **Caching**: Validation results cached for 60 seconds in-memory (node-cache)
  - Cache hit: credential validation done locally without Auth Service call
  - Cache miss: POST request to `{AUTH_SERVICE_URL}/auth/internal/validate-api-key` with 2000ms timeout
- On success: Sets `x-org-id`, `x-auth-type: api-key` headers. User ID and role not available for API Key auth.
- Response structure: `{ valid: true, organizationId: "org-id" }`

**2. JWT Authentication** (User Login):
- Header: `Authorization: Bearer <jwt-token>`
- **Local verification**: JWT signature verified instantly using `JWT_SECRET` (no external API call)
- JWT payload requirements: `userId`, `organizationId`, `role`, `email`
- On success: Sets `x-org-id`, `x-user-id`, `x-auth-type: jwt`, `x-user-email`, `x-role` headers.

**CORS Preflight**: OPTIONS requests skip authentication (allowed without credentials).

**Auth Failures**:
- Invalid/missing credentials: 401 Unauthorized
- Invalid JWT signature or expired: 401 Unauthorized + error message
- Invalid API Key/Secret: 401 Unauthorized

Usage Examples
- Health check:
```bash
curl http://localhost:8080/health
```
Returns: `{"service":"api-gateway","status":"UP"}`

- Organization registration (public):
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

- User login (public):
```bash
curl -X POST http://localhost:8080/auth/login \
	-H "Content-Type: application/json" \
	-d '{
		"email": "admin@acme.test",
		"password": "Str0ngPass!"
	}'
```
Returns: `{"token":"<jwt>","refreshToken":"<token>","organizationId":"<id>","role":"admin"}`

- User registration (protected, admin only):
```bash
curl -X POST http://localhost:8080/auth/register-user \
	-H "Authorization: Bearer <ADMIN_JWT>" \
	-H "Content-Type: application/json" \
	-d '{
		"email": "user@acme.test",
		"password": "Str0ngPass!",
		"firstName": "Jane",
		"lastName": "Doe",
		"organizationId": "<ORG_ID>"
	}'
```

- Change password (protected):
```bash
curl -X POST http://localhost:8080/auth/change-password \
	-H "Authorization: Bearer <JWT>" \
	-H "Content-Type: application/json" \
	-d '{
		"currentPassword": "OldPass123!",
		"newPassword": "NewPass123!"
	}'
```

- Forgot password (public):
```bash
curl -X POST http://localhost:8080/auth/forgot-password \
	-H "Content-Type: application/json" \
	-d '{"email":"user@acme.test"}'
```

- Refresh JWT token (public):
```bash
curl -X POST http://localhost:8080/auth/refresh \
	-H "Content-Type: application/json" \
	-d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

- Sanctions check (protected, JWT):
```bash
curl -X GET http://localhost:8080/sanctions/check?name=John%20Doe \
	-H "Authorization: Bearer <JWT>" \
	-H "Content-Type: application/json"
```

- Sanctions check (protected, API Key):
```bash
curl -X GET http://localhost:8080/sanctions/check?name=John%20Doe \
	-H "x-api-key: pk_live_xxxxx" \
	-H "x-api-secret: sk_live_yyyyy" \
	-H "Content-Type: application/json"
```

- Sanctions history (protected):
```bash
curl -X GET http://localhost:8080/sanctions/history \
	-H "Authorization: Bearer <JWT>"
```

- Logout (public):
```bash
curl -X POST http://localhost:8080/auth/logout \
	-H "Content-Type: application/json" \
	-d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

Response Headers (Forwarded to Downstream Services)
- `x-request-id` – unique request identifier for end-to-end tracing
- `x-org-id` – organization ID from JWT payload or API Key validation
- `x-user-id` – user ID from JWT payload (not present for API Key auth)
- `x-user-email` – user email from JWT payload or "api@system" for API Key auth
- `x-auth-type` – authentication method used: "jwt" or "api-key"
- `x-role` – user role from JWT payload (not present for API Key auth)

Error Responses
- **401 Unauthorized** – No valid credentials provided, or credentials are invalid/expired
  - Examples: Missing Authorization header, invalid JWT signature, invalid API Key
  - Response: `{"error":"Unauthorized: <reason>"}`
- **404 Not Found** – Route does not exist
- **429 Too Many Requests** – Rate limit exceeded for the IP address
  - Response: `{"error":"Too many requests from this IP, please try again later."}`
  - Headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
- **502 Bad Gateway** – Upstream service (Auth or Core) is unavailable
  - Response: `{"error":"<service> service unavailable"}`
- **500 Internal Server Error** – Gateway internal error

How It Works (High Level)
- **Request Flow**:
  1. Client sends HTTP request to gateway (with JWT or API Key headers)
  2. Global middleware: CORS, request ID generation, request logging
  3. Rate limiting middleware: Check request quota per IP (20 req/15min for /auth/*, 100 req/15min for others)
  4. Authentication middleware: Validate JWT signature or API Key (with caching)
  5. Proxy middleware: Forward request to upstream service with auth context headers
  6. Response: Upstream service response returned to client with rate limit headers
  
- **Rate Limiting**: express-rate-limit tracks requests per IP. Auth routes (10-20 req/15min), API routes (100 req/15min).
  
- **JWT Verification**: Instant local verification using `JWT_SECRET`. No external API call.
  
- **API Key Validation**: 
  - If cached (< 60s old): Use cache hit (no Auth Service call)
  - If not cached: POST to Auth Service `/auth/internal/validate-api-key`, cache result for 60s
  
- **Header Forwarding**: Proxy middleware injects `x-request-id`, `x-org-id`, `x-user-id`, `x-auth-type`, `x-user-email`, `x-role` into upstream request headers.
  
- **Logging**: Winston logger (console + daily rotating files in logs/). Logs request details (method, URL, ID, IP), auth outcomes, proxy errors.
  
- **Public vs Protected Routes**: Public routes (login, registration, forgot-password) require no auth. Protected routes (register-user, reset-secret, sanctions/*, users/*) require valid JWT or API Key.

Testing
-------

End-to-End (E2E) tests verify gateway routing, rate limiting, authentication, and header forwarding. Tests use Jest with Supertest for HTTP testing and nock for mocking upstream responses.

**Test File**: `tests/gateway.test.js`

**Test Suites**:

1. **API Gateway E2E** (core functionality)
   - Rate limiting enforcement on /sanctions/* (101st request returns 429)
   - Request routing to Auth Service (/auth/login, /auth/reset-password, /auth/refresh, /auth/change-password, /auth/forgot-password)
   - Request routing to Core Service (/sanctions/*)

2. **API Gateway - Authentication & Authorization**
   - Invalid JWT token returns 401
   - Missing Authorization header on protected routes returns 401
   - Valid API Key and Secret pass authentication
   - Invalid API Key returns 401

3. **API Gateway - Protected Routes Enforcement**
   - /auth/register-user requires authentication (401 without)
   - /auth/reset-secret requires authentication (401 without)
   - /auth/change-password requires authentication (401 without)
   - /sanctions/* requires authentication (401 without)
   - /users/* requires authentication (401 without)

4. **API Gateway - CORS & Headers**
   - OPTIONS preflight requests allowed without authentication (204)
   - Auth context headers injected to proxy requests (x-org-id, x-user-id, x-auth-type, x-role)

5. **API Gateway - Health Check**
   - /health returns 200 with service status
   - /health does not require authentication

6. **API Gateway - Error Handling**
   - Upstream service errors (5xx) are properly forwarded

**Test Execution**:
```bash
npm test
```

**Environment**:
- NODE_ENV=test (prevents server startup)
- Uses supertest for HTTP client (no listening port required)
- nock mocks upstream Auth and Core services
- JWT_SECRET and service URLs configured for test isolation

**Test Tools**:
- jest v30.2.0 – test runner with ES Modules support (cross-env NODE_OPTIONS=--experimental-vm-modules)
- supertest v7.2.2 – HTTP assertion library for testing Express routes
- nock v14.0.10 – HTTP request interceptor and mocker

**Example Test Output**:
```
PASS  tests/gateway.test.js
  API Gateway E2E
    ✓ Rate limiting: 101st request to /sanctions returns 429
    ✓ Routing: /auth/login is proxied to Auth Service
    ✓ Routing: /auth/reset-password is proxied to Auth Service
    ✓ Routing: /auth/refresh is proxied to Auth Service when authorized
    ✓ Routing: /sanctions/* is proxied to Core Service
    ✓ Routing: /auth/change-password is proxied to Auth Service
    ✓ Routing: /auth/forgot-password is proxied to Auth Service
  API Gateway - Authentication & Authorization
    ✓ Auth: Invalid JWT token returns 401
    ✓ Auth: Missing Authorization header on protected route returns 401
    ✓ Auth: Valid API Key and Secret passes authentication
    ✓ Auth: Invalid API Key returns 401
  API Gateway - Protected Routes Enforcement
    ✓ Protected: /auth/register-user requires authentication
    ✓ Protected: /auth/reset-secret requires authentication
    ✓ Protected: /auth/change-password requires authentication
    ✓ Protected: /sanctions/* requires authentication
    ✓ Protected: /users/* requires authentication
  API Gateway - CORS & Headers
    ✓ CORS: OPTIONS preflight request allowed without auth
    ✓ Headers: Auth context headers injected to proxy request
  API Gateway - Health Check
    ✓ Health: /health endpoint returns UP status
    ✓ Health: /health does not require authentication
  API Gateway - Error Handling
    ✓ Error: Upstream service error is handled

Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        7.4 s
```

