API Gateway
===========

Central reverse proxy and authentication gateway for the AML Checker platform. Routes requests to microservices (Auth Service, Core Service), enforces authentication on protected routes via JWT tokens or API keys, and forwards authentication context (organization ID, user ID, auth type, role, user email, user name) to downstream services.

**Version:** 1.0.0  
**Node.js:** 18+ (Alpine)  
**Type:** ES Modules

## Table of Contents

- [Stack and Dependencies](#stack-and-dependencies)
- [Environment and Configuration](#environment-and-configuration)
- [Rate Limiting](#rate-limiting)
- [Local Setup](#local-setup)
- [Docker Compose Setup](#docker-compose-setup)
- [Architecture](#architecture)
  - [Design Pattern](#design-pattern)
  - [Authentication Layer](#authentication-layer)
  - [Routing Strategy](#routing-strategy)
  - [Proxy Architecture](#proxy-architecture)
  - [Performance Optimizations](#performance-optimizations)
  - [Logging Infrastructure](#logging-infrastructure)
- [Endpoints](#endpoints)
  - [Gateway Endpoints](#gateway-endpoints)
  - [Auth Service Proxy (PUBLIC Routes)](#auth-service-proxy-public-routes)
  - [Auth Service Proxy (PROTECTED Routes)](#auth-service-proxy-protected-routes)
  - [Sanctions Service Proxy (Core Service)](#sanctions-service-proxy-core-service)
  - [Users Management Proxy (Auth Service)](#users-management-proxy-auth-service)
  - [Context Headers (Injected by Gateway)](#context-headers-injected-by-gateway)
- [Authentication Middleware](#authentication-middleware)
  - [1. API Key Authentication (B2B Integration)](#1-api-key-authentication-b2b-integration)
  - [2. JWT Authentication (User Login)](#2-jwt-authentication-user-login)
  - [Special Cases](#special-cases)
- [Usage Examples](#usage-examples)
  - [Health Check](#health-check)
  - [User Login (Public)](#user-login-public)
  - [Refresh JWT Token (Public)](#refresh-jwt-token-public)
  - [Logout (Public)](#logout-public)
  - [Register Organization (SuperAdmin Only)](#register-organization-superadmin-only)
  - [Register User (Admin Only)](#register-user-admin-only)
  - [Change Password (Authenticated)](#change-password-authenticated)
  - [Sanctions Screening (JWT)](#sanctions-screening-jwt)
  - [Sanctions Screening (API Key)](#sanctions-screening-api-key)
  - [Get Sanctions History (JWT)](#get-sanctions-history-jwt)
  - [Get Sanctions Statistics (JWT)](#get-sanctions-statistics-jwt)
  - [Get Users List (Admin)](#get-users-list-admin)
  - [Create User (Admin)](#create-user-admin)
  - [Delete User (Admin)](#delete-user-admin)
  - [Get Organization API Key (Authenticated)](#get-organization-api-key-authenticated)
- [Testing](#testing)
  - [Test Coverage](#test-coverage)
  - [Running Tests](#running-tests)
  - [Example Output](#example-output)

---

## Stack and Dependencies

**Core Framework:**
- **Node.js 18+** (Alpine) – Lightweight production runtime
- **Express 5.2.1** – Fast, minimalist web framework with ES Modules support

**Proxy & Routing:**
- **http-proxy-middleware** v3.0.5 – Flexible request routing and proxying to upstream services (Auth, Core)

**Authentication & Security:**
- **jsonwebtoken** v9.0.3 – JWT signature verification (local, no external calls)
- **axios** v1.13.2 – HTTP client for API Key validation requests to Auth Service
- **node-cache** v5.1.2 – In-memory caching for API key validation (60s TTL, ~60x performance gain)
- **cors** v2.8.5 – Cross-Origin Resource Sharing configuration
- **express-rate-limit** v8.2.1 – IP-based rate limiting (20 req/15min auth, 100 req/15min API)

**Configuration & Documentation:**
- **dotenv** v17.2.3 – Environment variable management
- **swagger-ui-express** v5.0.0 + **yamljs** v0.3.0 – Interactive OpenAPI v3 documentation at `/api-docs`

**Logging:**
- **winston** v3.19.0 – Structured logging with multiple transports
- **winston-daily-rotate-file** v5.0.0 – Automatic log rotation (daily app/error logs)

**Development & Testing:**
- **jest** v30.2.0 – Test runner with ES Modules support
- **supertest** v7.2.2 – HTTP assertions for E2E testing
- **nock** v14.0.10 – HTTP request mocking for isolated tests
- **cross-env** v10.1.0 – Cross-platform environment variables

Environment and Configuration
- `AUTH_SERVICE_URL` – address of Auth Service; defaults to `http://auth-service:3000` in Docker network.
- `CORE_SERVICE_URL` – address of Core Service; defaults to `http://core-service:3000` in Docker network.
- `JWT_SECRET` – **required** secret key for JWT token verification (must match Auth Service's `JWT_SECRET`). Gateway fails fast if missing.
- `PORT` – application port (default 8080).
- `NODE_ENV` – environment (set to `test` during tests to prevent server startup).
- `ALLOWED_ORIGINS` – comma-separated list of allowed CORS origins. Defaults to `http://localhost`, `http://localhost:80`, `http://localhost:3000`, `http://localhost:5173`.

## Rate Limiting

**Auth Endpoints** (`/auth/*`):  
- **20 requests per 15 minutes per IP**
- Applies to: login, registration, password reset, token refresh, logout, organization management

**API Endpoints** (`/sanctions/*`, `/users/*`):  
- **100 requests per 15 minutes per IP**
- Applies to: sanctions screening, history, statistics, user management

**Behavior:**
- Exceeded limit:
  - `/auth/*` responds with `"Too many auth requests from this IP, please try again later."`
  - `/sanctions/*` and `/users/*` respond with `"Too many requests from this IP, please try again later."`
- Rate limit headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
- Tracking: Per IP address using express-rate-limit

Local Setup
1) `npm install`
2) Set `JWT_SECRET` (required); optionally set service URLs and `ALLOWED_ORIGINS`
3) `node src/index.js`
4) `npm test` (for running E2E tests)

Docker Compose Setup
- From project root directory: `docker compose up --build api-gateway`
- Gateway will be available at http://localhost:8080
- OpenAPI docs available at http://localhost:8080/api-docs

## Architecture

**Design Pattern:**
- **Class-Based OOP**: `GatewayServer` class ([src/GatewayServer.js](src/GatewayServer.js)) encapsulates all gateway logic
  - Global middleware configuration (CORS, logging, Swagger)
  - Rate limiter setup (auth/API tiers)
  - Proxy configuration (auth-service, core-service, users)
  - Route registration with authentication guards

**Authentication Layer:**
- **AuthMiddleware** ([src/authMiddleware.js](src/authMiddleware.js)) – Standalone class handling dual authentication
  - JWT verification: Local signature check using `JWT_SECRET` (no external calls)
  - API Key validation: Cached validation with 60-second TTL (reduces Auth Service calls by ~60x)
  - Context injection: Attaches `x-org-id`, `x-user-id`, `x-role`, `x-auth-type`, `x-user-email`, `x-user-name` to request headers

**Routing Strategy:**
- **Route Priority**: Protected routes registered **before** public routes to prevent proxy conflicts
  - Example: `/auth/register-user` before `/auth/login`
- **Route Configuration**: Defined in [src/config/routes.js](src/config/routes.js) (reference), implemented in `GatewayServer.setupRoutes()`

**Proxy Architecture:**
- **http-proxy-middleware**: Forwards requests to upstream services with header injection
- **Header Forwarding**: Custom `onProxyReq` callbacks inject authentication context:
  - `x-request-id` – unique request identifier
  - `x-org-id` – organization UUID
  - `x-user-id` – user UUID (JWT only)
  - `x-user-email` – user email or `"api@system"`
  - `x-user-name` – full name when available
  - `x-role` – user role (JWT only)
  - `x-auth-type` – authentication method (`jwt`/`api-key`)
- **Error Handling**: Custom `onError` callbacks return 502 for upstream failures

**Performance Optimizations:**
- **API Key Caching**: node-cache with 60-second TTL (in-memory)
  - Cache hit: Instant validation without Auth Service call
  - Cache miss: Single validation call, result cached for subsequent requests
- **Request Tracking**: UUID-based `x-request-id` for distributed tracing

**Logging Infrastructure:**
- **Winston Logger** ([src/utils/logger.js](src/utils/logger.js))
  - Console transport: Colorized, timestamped logs
  - File transports: Daily rotation (logs/%DATE%-app.log, logs/%DATE%-error.log)
  - Log levels: info, debug, warn, error
  - Structured format: JSON with metadata (requestId, userId, orgId, etc.)

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
| POST | `/auth/login` | ❌ No | Auth Service | User login (returns JWT access token + refresh token) |
| POST | `/auth/forgot-password` | ❌ No | Auth Service | Request password reset email with token |
| POST | `/auth/reset-password` | ❌ No | Auth Service | Reset password using token from email |
| POST | `/auth/refresh` | ❌ No | Auth Service | Refresh JWT access token using refresh token |
| POST | `/auth/logout` | ❌ No | Auth Service | Logout and revoke refresh token from database |

### Auth Service Proxy (PROTECTED Routes)

All protected routes require authentication and are rate limited to **20 requests per 15 minutes per IP**. Role context is only available when using JWT.

| Method | Endpoint | Auth Required | Role Required | Proxied To | Description |
|--------|----------|---------------|---------------|------------|-------------|
| POST | `/auth/register-organization` | ✅ JWT or API Key | superadmin | Auth Service | Register new organization with admin user (SuperAdmin only) |
| POST | `/auth/register-user` | ✅ JWT or API Key | admin/superadmin | Auth Service | Register new user in organization |
| POST | `/auth/reset-secret` | ✅ JWT or API Key | admin/superadmin | Auth Service | Reset organization's API secret (requires password confirmation) |
| POST | `/auth/change-password` | ✅ JWT or API Key | - | Auth Service | Change user's password (requires current password) |
| GET | `/auth/organization/keys` | ✅ JWT or API Key | - | Auth Service | Get organization's public API key |

### Sanctions Service Proxy (Core Service)

All sanctions routes require **JWT or API Key authentication** and are rate limited to **100 requests per 15 minutes per IP**.

| Method | Endpoint | Auth Required | Proxied To | Description | Query Parameters |
|--------|----------|---------------|------------|-------------|-----------------|
| GET | `/sanctions/check` | ✅ JWT or API Key | Core Service | Check entity against sanctions/PEP lists | `name` (required), `limit`, `fuzzy`, `schema`, `country` |
| GET | `/sanctions/history` | ✅ JWT or API Key | Core Service | Retrieve audit logs with pagination and filtering | `page`, `limit`, `search`, `hasHit`, `startDate`, `endDate`, `userId`, `orgId` |
| GET | `/sanctions/stats` | ✅ JWT or API Key | Core Service | Get aggregated statistics for organization | - |
| GET | `/sanctions/health` | ✅ JWT or API Key | Core Service | Health check for Core Service | - |

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
| `x-user-email` | JWT payload or API Key auth | User email or `"api@system"` for API Key auth |
| `x-user-name` | JWT payload | Full name when available (falls back to email) |
| `x-auth-type` | Gateway | Authentication method: `"jwt"` or `"api-key"` |
| `x-role` | JWT payload | User role: `"superadmin"`, `"admin"`, or `"user"` - not present for API Key auth |

## Authentication Middleware

The **AuthMiddleware** ([src/authMiddleware.js](src/authMiddleware.js)) validates two authentication methods with automatic caching:

### 1. API Key Authentication (B2B Integration)

**Request Headers:**
- `x-api-key`: Organization API key (e.g., `pk_live_xxxxx`)
- `x-api-secret`: Organization API secret (e.g., `sk_live_yyyyy`)

**Validation Flow:**
1. **Cache Check**: Look up `apiKey:apiSecret` in node-cache (60s TTL)
   - **Cache Hit**: Return cached `orgId` immediately (no Auth Service call)
   - **Cache Miss**: Proceed to step 2
2. **Auth Service Validation**: POST to `{AUTH_SERVICE_URL}/auth/internal/validate-api-key` (2000ms timeout)
3. **Cache Result**: Store `{ orgId, authType: 'api-key' }` for 60 seconds
4. **Inject Headers**: Attach `x-org-id`, `x-auth-type: api-key`, `x-user-email: api@system` to request

**Response Structure:**
```json
{ "valid": true, "organizationId": "uuid", "organizationName": "ACME Corp" }
```

**Notes:**
- User ID and role **not available** for API Key authentication
- Performance: ~60x reduction in Auth Service calls due to caching

### 2. JWT Authentication (User Login)

**Request Header:**
- `Authorization: Bearer <jwt-token>`

**Validation Flow:**
1. **Extract Token**: Parse Bearer token from Authorization header
2. **Local Verification**: Verify JWT signature using `JWT_SECRET` (no external API call)
3. **Decode Payload**: Extract `userId`, `organizationId`, `role`, `email`, optional `firstName`, `lastName`
4. **Inject Headers**: Attach `x-org-id`, `x-user-id`, `x-role`, `x-auth-type: jwt`, `x-user-email`, `x-user-name` to request

**JWT Payload Requirements:**
```json
{
  "userId": "uuid",
  "organizationId": "uuid",
  "role": "admin|user|superadmin",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Notes:**
- Instant verification (cryptographic signature check)
- No database or external service calls

### Special Cases

**CORS Preflight:**
- OPTIONS requests bypass authentication (return 204 immediately)

**Authentication Failures:**
- Missing or invalid credentials: `401 Unauthorized` – `"Unauthorized: Missing or invalid credentials"`
- Invalid/expired JWT: `401 Unauthorized` – `"Unauthorized: Invalid or expired JWT token"`
- Invalid API Key/Secret: `401 Unauthorized` – `"Unauthorized: Invalid API Key or Secret"`

## Usage Examples

### Health Check
```bash
curl http://localhost:8080/health
```
**Response:**
```json
{"service":"api-gateway","status":"UP"}
```

### User Login (Public)
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.test",
    "password": "Str0ngPass!"
  }'
```
**Response:**
```json
{
  "message": "Login successful",
  "accessToken": "<JWT>",
  "refreshToken": "<REFRESH_TOKEN>",
  "user": {
    "id": "uuid",
    "email": "admin@acme.test",
    "role": "admin",
    "firstName": "John",
    "lastName": "Smith",
    "organizationId": "uuid"
  }
}
```

### Refresh JWT Token (Public)
```bash
curl -X POST http://localhost:8080/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```
**Response:**
```json
{"accessToken":"<NEW_JWT>"}
```

### Logout (Public)
```bash
curl -X POST http://localhost:8080/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

### Forgot Password (Public)
```bash
curl -X POST http://localhost:8080/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@acme.test"}'
```

### Register Organization (Protected, SuperAdmin Only)
```bash
curl -X POST http://localhost:8080/auth/register-organization \
  -H "Authorization: Bearer <SUPERADMIN_JWT>" \
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

### Register User (Protected, Admin Only)
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

### Change Password (Protected)
```bash
curl -X POST http://localhost:8080/auth/change-password \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPass123!",
    "newPassword": "NewPass123!"
  }'
```

### Sanctions Check with JWT (Protected)
```bash
curl -X GET "http://localhost:8080/sanctions/check?name=John%20Doe" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json"
```

### Sanctions Check with API Key (Protected)
```bash
curl -X GET "http://localhost:8080/sanctions/check?name=John%20Doe" \
  -H "x-api-key: pk_live_xxxxx" \
  -H "x-api-secret: sk_live_yyyyy" \
  -H "Content-Type: application/json"
```

### Sanctions History with Filters (Protected)
```bash
curl -X GET "http://localhost:8080/sanctions/history?page=1&limit=10&hasHit=true&startDate=2026-01-01" \
  -H "Authorization: Bearer <JWT>"
```

### Get Dashboard Statistics (Protected)
```bash
curl -X GET http://localhost:8080/sanctions/stats \
  -H "Authorization: Bearer <JWT>"
```

### List Users (Protected, Admin Only)
```bash
curl -X GET http://localhost:8080/users \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

Response Headers (Forwarded to Downstream Services)
- `x-request-id` – unique request identifier for end-to-end tracing
- `x-org-id` – organization ID from JWT payload or API Key validation
- `x-user-id` – user ID from JWT payload (not present for API Key auth)
- `x-user-email` – user email from JWT payload or "api@system" for API Key auth
- `x-user-name` – full name from JWT payload when available
- `x-auth-type` – authentication method used: "jwt" or "api-key"
- `x-role` – user role from JWT payload (not present for API Key auth)

## Error Responses

| Status | Error | Description | Response |
|--------|-------|-------------|----------|
| **401** | Unauthorized | No valid credentials or expired/invalid token | `{"error":"Unauthorized: <reason>"}` |
| **403** | Forbidden | Valid auth but insufficient permissions (e.g., non-admin trying admin action) | `{"error":"Forbidden: <reason>"}` |
| **404** | Not Found | Route does not exist | `{"error":"Not found"}` |
| **429** | Too Many Requests | Rate limit exceeded for IP address | `{"error":"Too many auth requests from this IP, please try again later."}` (auth) / `{"error":"Too many requests from this IP, please try again later."}` (api) |
| **502** | Bad Gateway | Upstream service (Auth/Core) unavailable | `{"error":"<service> service unavailable"}` |
| **500** | Internal Error | Gateway internal error | `{"error":"Internal server error"}` |

**Rate Limit Headers (429 response):**
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining in current window
- `RateLimit-Reset`: Timestamp when limit resets

How It Works (High Level)
- **Request Flow**:
  1. Client sends HTTP request to gateway (with JWT or API Key headers)
  2. Global middleware: CORS, request ID generation, request logging
  3. Rate limiting middleware: Check request quota per IP (20 req/15min for /auth/*, 100 req/15min for others)
  4. Authentication middleware: Validate JWT signature or API Key (with caching)
  5. Proxy middleware: Forward request to upstream service with auth context headers
  6. Response: Upstream service response returned to client with rate limit headers
  
- **Rate Limiting**: express-rate-limit tracks requests per IP. Auth routes (20 req/15min), API routes (100 req/15min).
  
- **JWT Verification**: Instant local verification using `JWT_SECRET`. No external API call.
  
- **API Key Validation**: 
  - If cached (< 60s old): Use cache hit (no Auth Service call)
  - If not cached: POST to Auth Service `/auth/internal/validate-api-key`, cache result for 60s
  
- **Header Forwarding**: Proxy middleware injects `x-request-id`, `x-org-id`, `x-user-id`, `x-auth-type`, `x-user-email`, `x-user-name`, `x-role` into upstream request headers.
  
- **Logging**: Winston logger (console + daily rotating files in logs/). Logs request details (method, URL, ID, IP), auth outcomes, proxy errors.
  
- **Public vs Protected Routes**: Public routes (login, registration, forgot-password) require no auth. Protected routes (register-user, reset-secret, sanctions/*, users/*) require valid JWT or API Key.

## Testing

End-to-End (E2E) tests verify gateway routing, rate limiting, authentication, and header forwarding using Jest with Supertest and nock for mocking upstream services.

**Test File:** [tests/gateway.test.js](tests/gateway.test.js)

### Test Suites

**1. API Gateway E2E** (Core Functionality)
- ✅ Rate limiting enforcement on `/sanctions/*` (101st request returns 429)
- ✅ Request routing to Auth Service (`/auth/login`, `/auth/reset-password`, `/auth/refresh`, `/auth/change-password`, `/auth/forgot-password`)
- ✅ Request routing to Core Service (`/sanctions/*`)

**2. Authentication & Authorization**
- ✅ Invalid JWT token returns 401
- ✅ Missing Authorization header on protected routes returns 401
- ✅ Valid API Key and Secret pass authentication
- ✅ Invalid API Key returns 401

**3. Protected Routes Enforcement**
- ✅ `/auth/register-user` requires authentication
- ✅ `/auth/reset-secret` requires authentication
- ✅ `/auth/change-password` requires authentication
- ✅ `/sanctions/*` requires authentication
- ✅ `/users/*` requires authentication

**4. CORS & Headers**
- ✅ OPTIONS preflight requests allowed without authentication (204)
- ✅ Auth context headers injected to proxy requests (`x-org-id`, `x-user-id`, `x-auth-type`, `x-role`)

**5. Health Check**
- ✅ `/health` returns 200 with service status
- ✅ `/health` does not require authentication

**6. Error Handling**
- ✅ Upstream service errors (5xx) properly forwarded

### Running Tests

```bash
npm test
```

**Test Configuration:**
- `NODE_ENV=test` (prevents server startup)
- Uses supertest for HTTP assertions (no listening port required)
- nock mocks upstream Auth and Core services
- JWT_SECRET and service URLs configured for test isolation

**Test Tools:**
- **jest** v30.2.0 – Test runner with ES Modules support (`cross-env NODE_OPTIONS=--experimental-vm-modules`)
- **supertest** v7.2.2 – HTTP assertion library for Express routes
- **nock** v14.0.10 – HTTP request interceptor and mocker

### Example Output

```
PASS  tests/gateway.test.js
  API Gateway E2E
    ✓ Rate limiting: 101st request to /sanctions returns 429 (45ms)
    ✓ Routing: /auth/login is proxied to Auth Service (12ms)
    ✓ Routing: /auth/reset-password is proxied to Auth Service (8ms)
    ✓ Routing: /auth/refresh is proxied to Auth Service (10ms)
    ✓ Routing: /sanctions/* is proxied to Core Service (15ms)
    ✓ Routing: /auth/change-password is proxied to Auth Service (9ms)
    ✓ Routing: /auth/forgot-password is proxied to Auth Service (11ms)
  API Gateway - Authentication & Authorization
    ✓ Auth: Invalid JWT token returns 401 (7ms)
    ✓ Auth: Missing Authorization header returns 401 (6ms)
    ✓ Auth: Valid API Key and Secret passes authentication (18ms)
    ✓ Auth: Invalid API Key returns 401 (14ms)
  API Gateway - Protected Routes Enforcement
    ✓ Protected: /auth/register-user requires authentication (8ms)
    ✓ Protected: /auth/reset-secret requires authentication (7ms)
    ✓ Protected: /auth/change-password requires authentication (6ms)
    ✓ Protected: /sanctions/* requires authentication (9ms)
    ✓ Protected: /users/* requires authentication (8ms)
  API Gateway - CORS & Headers
    ✓ CORS: OPTIONS preflight allowed without auth (5ms)
    ✓ Headers: Auth context headers injected (12ms)
  API Gateway - Health Check
    ✓ Health: /health endpoint returns UP status (4ms)
    ✓ Health: /health does not require authentication (3ms)
  API Gateway - Error Handling
    ✓ Error: Upstream service error handled (10ms)

Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        2.145 s
```

