# AML Checker
> Microservice-based platform for automatic sanctions and PEP screening using a local OpenSanctions (Yente) instance. Includes organization/user management with JWT and API key authentication, API Gateway for request routing and authentication enforcement, and audit logging of all sanctions checks.

## Table of Contents
* [General Information](#general-information)
* [Architecture](#architecture)
* [Technologies Used](#technologies-used)
* [Features](#features)
* [Setup](#setup)
* [Usage](#usage)
* [Project Status](#project-status)
* [Room for Improvement](#room-for-improvement)
* [Acknowledgements](#acknowledgements)
* [Contact](#contact)

## General Information
- Goal: provide a local, reproducible microservice platform to screen customers against OpenSanctions data, manage organizations and users, enforce API access control, and maintain audit logs of all screening activities.
- Uses Yente as the local sanctions API (fed by [manifest.yml](manifest.yml)) powered by Elasticsearch.
- Auth Service manages organizations and users with JWT and API key authentication.
- API Gateway routes requests to microservices and enforces authentication on protected endpoints.
- Core Service logs all sanctions checks and provides audit history per organization.
- The stack starts via Docker Compose, including MongoDB (auth), PostgreSQL (core-service), Elasticsearch (Yente), and Yente instance.

## Architecture

**Microservice Architecture** (Docker-based):

1. **API Gateway** ([api-gateway/](api-gateway/)) – Central entry point for all client requests
	- Port: 8080 (mapped via `GATEWAY_PORT`, default 8080)
	- Responsibilities: request routing (reverse proxy), authentication enforcement, header forwarding
	- Routes: `/auth/*` (public) → Auth Service; `/sanctions/*` (protected) → Core Service
	- Supports two authentication methods: JWT (user login) and API Key/Secret (B2B system-to-system)
	- Adds context headers (`x-org-id`, `x-user-id`, `x-auth-type`) to downstream requests
	- OpenAPI docs: available at http://localhost:8080/api-docs

2. **Auth Service** ([auth-service/](auth-service/)) – User and organization management
	- Port: 3000 (mapped via `PORT_AUTH`, default 3002)
	- Database: MongoDB 6 (Mongoose 9 ORM)
	- Responsibilities: organization registration with API key generation, user registration, user login with JWT access + refresh tokens, password reset flow, API key validation (internal endpoint for API Gateway)
	- Endpoints: `/auth/register-organization`, `/auth/register-user`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/reset-secret` (admin only), `/auth/internal/validate-api-key`, `/health`
	- Generates JWT tokens: `accessToken` (valid 15 minutes) and `refreshToken` (valid 7 days)
	- Generates API keys (`pk_live_...`) and secrets (`sk_live_...`); secrets hashed with bcryptjs
	- Supports three user roles: `superadmin`, `admin`, `user`

3. **Core Service** ([core-service/](core-service/)) – Sanctions checking and audit logging
	- Port: 3000 (mapped to 3005 for debug; accessed via API Gateway on production)
	- Database: PostgreSQL 15 (Sequelize 6 ORM)
	- Responsibilities: forward sanctions queries to OP Adapter, log audit trail, return history
	- Enforces organization-based data isolation: users see only their organization's logs
	- Endpoints: `/check` (sanctions check with audit), `/history` (audit log), `/health`

4. **OP Adapter** ([op-adapter/](op-adapter/)) – OpenSanctions Yente wrapper
	- Port: 3000 (mapped to 3001)
	- Responsibilities: translate HTTP requests into Yente API calls, map Yente responses to simplified format, automatic retry on failures
	- Retry mechanism: axios-retry with 3 attempts and exponential backoff (1s → 2s → 4s) for network errors and 5xx responses
	- Endpoints: `/check?name=<entity>` (sanctions/PEP check with request tracking), `/health`
	- Extracts sanctions flags: `isSanctioned`, `isPep` from Yente topics

5. **Yente** (OpenSanctions Local API) – Sanctions data service
	- Image: `ghcr.io/opensanctions/yente:5.1.0`
	- Port: 8000 (mapped via `YENTE_PORT`, default 8000)
	- Backend: Elasticsearch 8.11 (single-node, data in `es_data` volume)
	- Data: Downloaded from manifest (can be full OpenSanctions dataset or scoped like `us_ofac_sdn`)
	- Manages: compliance datasets (OFAC, UN, EU, etc.), PEP lists, corporate registries

6. **Data Stores**:
	- **MongoDB** (port 27017 mapped via `MONGO_PORT`, default 27017) – Auth Service data (organizations, users, API keys)
	- **PostgreSQL** (port 5432 mapped via `POSTGRES_PORT`, default 5432) – Core Service audit logs
	- **Elasticsearch** (port 9200) – Yente data (sanctions lists, PEP data)

**Request Flow**:
```
Client → API Gateway (auth check) → Auth Service (register/login) or Core Service (sanctions check)
                                        ↓
                                    OP Adapter → Yente (search)
                                        ↓
                                  PostgreSQL (audit log)
```

## Technologies Used
- **Runtime**: Node.js 18, ES Modules
- **API Framework**: Express 5 (multiple microservices)
- **Databases**: 
	- MongoDB 6 (Mongoose 9 ORM) for Auth Service
	- PostgreSQL 15 (Sequelize 6 ORM) for Core Service
	- Elasticsearch 8.11 for Yente
- **Sanctions Data**: OpenSanctions Yente 5.1 (local instance)
- **Authentication**: bcryptjs (password/secret hashing), jsonwebtoken (JWT), API Key validation
- **Validation**: joi (request payload validation for email format, password strength)
- **Rate Limiting**: express-rate-limit (per-IP request throttling for auth and API endpoints)
- **HTTP/Networking**: axios (inter-service calls), CORS middleware, http-proxy-middleware (reverse proxy)
- **Infrastructure**: Docker Compose 3.8, environment variables (.env)
- **Development**: nodemon (watch mode)

## Features
- **Organization & User Management**: 
	- Register organizations with automatic API key (`apiKey`, `apiSecret`) generation
	- Add users to organizations with role-based access (`superadmin`, `admin`, `user`)
	- User login returning access token (15 minutes) and refresh token (7 days)
	- Refresh access token using refresh token without re-authenticating
	- Logout revokes refresh token, preventing further access token generation
	- Password reset flow: request reset via `/forgot-password` (sends email with token), reset password with token via `/reset-password`
	- API key validation for system-to-system (B2B) authentication
	- Reset organization API secret (`/reset-secret` admin-only endpoint)
	- **Request validation** using Joi: email format validation, password minimum 8 characters for registration and password reset

- **API Gateway & Authentication**:
	- Central API Gateway routing public (`/auth`) and protected (`/sanctions`) endpoints
	- Two authentication methods: JWT (user login) and API Key/Secret (B2B)
	- **Rate limiting**: 10 requests per 15 minutes for auth endpoints, 100 requests per 15 minutes for API endpoints (per IP address)
	- Automatic context header injection (`x-org-id`, `x-user-id`, `x-auth-type`, `x-role`) for downstream services
	- Organization-based isolation: users can only access their organization's data
	- Superadmin access: superadmin users can access all organizations' audit logs

- **Sanctions & PEP Screening**:
	- Real-time screening via GET `/sanctions/check?name=` against OpenSanctions data
	- **Configurable search parameters**: `limit` (default 15), `fuzzy` (default false), `schema` (filter by entity type), `country` (filter by country code)
	- Maps Yente results to simplified response with flags: `isSanctioned`, `isPep`
	- Returns entity details: name, schema (Person/Company), country, birth date, birthplace, gender, nationality, position, aliases, addresses, match score
	- Supports OFAC, UN, EU, and other sanctions lists via Yente
	- Request tracking with `x-request-id` header for end-to-end tracing

- **Audit Logging & Compliance**:
	- Automatic logging of all sanctions checks to audit table (PostgreSQL)
	- Audit log includes: organization ID, user ID, search query, hit status, hit count, timestamp
	- **Paginated history** endpoint with **advanced filtering**: text search, hit status filter, date range filter, user ID filter, superadmin org filter
	- History endpoint supports: `page`, `limit`, `search`, `hasHit`, `startDate`, `endDate`, `userId`, `orgId` (superadmin only)
	- Data isolation: organizations can only view their own audit logs; superadmins can view all or filter by organization

- **Resilience & Performance**:
	- Automatic retry mechanism in OP Adapter (3 retries, exponential backoff) for Yente API calls
	- Health checks for all services with database connection status
	- Docker health checks for container orchestration

## Setup

### Requirements
- Docker + Docker Compose (for containerized stack)
- Node.js 18 (optional; for running services locally without Docker)

### Quick Start
1. Clone the repository:
```bash
git clone <repository-url>
cd AML-Checker
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env and set strong values for:
# - JWT_SECRET (long random string for JWT signing)
# - MONGO_INITDB_ROOT_PASSWORD, POSTGRES_PASSWORD (database credentials)
# - Ports (GATEWAY_PORT, PORT_AUTH, YENTE_PORT, POSTGRES_PORT, MONGO_PORT)
```

3. Start the entire stack:
```bash
docker compose up --build
```

4. Wait for services to initialize (especially Yente downloading datasets; 2-5 minutes on first run)

5. Verify health of all services:
```bash
curl http://localhost:8080/health          # API Gateway
curl http://localhost:3002/health          # Auth Service (or PORT_AUTH)
curl http://localhost:3001/health          # OP Adapter
curl http://localhost:3005/health          # Core Service (debug port)
curl http://localhost:8000/health          # Yente (or YENTE_PORT)
```

Open Swagger UI for Gateway:
http://localhost:8080/api-docs

### Environment Variables (.env)
See [.env.example](.env.example) for template. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | (required) | Secret key for signing JWT access tokens; must be long and random |
| `REFRESH_TOKEN_SECRET` | (required) | Secret key for signing refresh tokens; must be long and random and different from JWT_SECRET |
| `FRONTEND_URL` | http://localhost:3000 | Frontend URL for password reset email links |
| `GATEWAY_PORT` | 8080 | API Gateway external port |
| `PORT_AUTH` | 3002 | Auth Service external port |
| `PORT_OP_ADAPTER` | 3001 | OP Adapter external port |
| `YENTE_PORT` | 8000 | Yente API external port |
| `POSTGRES_PORT` | 5432 | PostgreSQL external port |
| `MONGO_PORT` | 27017 | MongoDB external port |
| `MONGO_INITDB_ROOT_PASSWORD` | (required) | MongoDB root password |
| `POSTGRES_PASSWORD` | (required) | PostgreSQL root password |
| `POSTGRES_DB` | core_db | PostgreSQL database name for Core Service |
| `AUTH_SERVICE_URL` | http://auth-service:3000 | API Gateway target for Auth Service |
| `CORE_SERVICE_URL` | http://core-service:3000 | API Gateway target for Core Service |
| `OP_ADAPTER_URL` | http://op-adapter:3000 | Core Service target for OP Adapter |
| `YENTE_API_URL` | http://localhost:8000 | OP Adapter target for Yente API |

### Data Persistence
Services use Docker volumes:
- `mongo_data` – Auth Service data (organizations, users)
- `postgres_data` – Core Service audit logs
- `es_data` – Elasticsearch indices (Yente data)
- `yente_data` – Downloaded sanctions datasets

Data persists across container restarts. To reset: `docker compose down -v` (warning: deletes all data).

## Usage

### 1. Register Organization (Admin Setup)
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
**Response includes**:
- `organization.id` (save as `<ORG_ID>`)
- `organization.apiKey` (format: `pk_live_...`)
- `organization.apiSecret` (format: `sk_live_...`; returned **only once** – save securely!)

### 2. Register Additional User
```bash
curl -X POST http://localhost:8080/auth/register-user \
	-H "Content-Type: application/json" \
	-d '{
		"email": "user@acme.test",
		"password": "Str0ngPass!",
		"firstName": "Jane",
		"lastName": "Doe",
		"organizationId": "<ORG_ID>"
	}'
```

### 3. User Login (Get JWT Tokens)
```bash
curl -X POST http://localhost:8080/auth/login \
	-H "Content-Type: application/json" \
	-d '{
		"email": "admin@acme.test",
		"password": "Str0ngPass!"
	}'
```
**Response includes**:
- `accessToken` – JWT valid for 15 minutes (use in `Authorization: Bearer <accessToken>` header)
- `refreshToken` – JWT valid for 7 days (save for token refresh)

### 3.5 Refresh Access Token (Before Expiration)
```bash
curl -X POST http://localhost:8080/auth/refresh \
	-H "Content-Type: application/json" \
	-d '{
		"refreshToken": "<REFRESH_TOKEN>"
	}'
```
**Response includes**:
- `accessToken` – new JWT valid for 15 minutes

### 3.75 Logout (Revoke Refresh Token)
```bash
curl -X POST http://localhost:8080/auth/logout \
	-H "Content-Type: application/json" \
	-d '{
		"refreshToken": "<REFRESH_TOKEN>"
	}'
```

### 4. Request Password Reset (Forgot Password)
```bash
curl -X POST http://localhost:8080/auth/forgot-password \
	-H "Content-Type: application/json" \
	-d '{
		"email": "admin@acme.test"
	}'
```
**Response**: Success message (email sent with reset link and token valid for 1 hour)

### 4.5 Reset Password (Using Token from Email)
```bash
curl -X POST http://localhost:8080/auth/reset-password \
	-H "Content-Type: application/json" \
	-d '{
		"userId": "<USER_ID>",
		"token": "<TOKEN_FROM_EMAIL>",
		"newPassword": "NewStr0ngPass!"
	}'
```

### 5. Reset Organization API Secret (Admin Only)
```bash
curl -X POST http://localhost:8080/auth/reset-secret \
	-H "Authorization: Bearer <ACCESS_TOKEN>" \
	-H "Content-Type: application/json"
```
**Response includes**:
- `apiKey` – same as before
- `newApiSecret` – new secret (plaintext, visible **only once**)

### 6. Sanctions Check with JWT
```bash
curl -X GET "http://localhost:8080/sanctions/check?name=John%20Doe" \
	-H "Authorization: Bearer <ACCESS_TOKEN>" \
	-H "Content-Type: application/json"
```
**Response includes**:
- `hits_count` – number of matches found
- `data[]` – array of entities with `isSanctioned`, `isPep`, `score` flags

### 7. Sanctions Check with API Key (B2B)
```bash
curl -X GET "http://localhost:8080/sanctions/check?name=Jane%20Smith" \
	-H "x-api-key: <API_KEY>" \
	-H "x-api-secret: <API_SECRET>"
```

### 8. Retrieve Audit History
```bash
curl -X GET http://localhost:8080/sanctions/history \
	-H "Authorization: Bearer <JWT_TOKEN>"
```
**Response**: Paginated array of sanctions checks for the organization with metadata (totalItems, totalPages, currentPage, itemsPerPage)

### 8a. Retrieve Audit History with Filters
```bash
# Search for entity name
curl -X GET "http://localhost:8080/sanctions/history?search=John" \
	-H "Authorization: Bearer <JWT_TOKEN>"

# Filter by hit status (only hits)
curl -X GET "http://localhost:8080/sanctions/history?hasHit=true" \
	-H "Authorization: Bearer <JWT_TOKEN>"

# Filter by date range
curl -X GET "http://localhost:8080/sanctions/history?startDate=2025-12-01T00:00:00Z&endDate=2025-12-31T23:59:59Z" \
	-H "Authorization: Bearer <JWT_TOKEN>"

# Pagination (page 2, 50 items per page)
curl -X GET "http://localhost:8080/sanctions/history?page=2&limit=50" \
	-H "Authorization: Bearer <JWT_TOKEN>"

# Combined filters (search + date range + pagination)
curl -X GET "http://localhost:8080/sanctions/history?search=John&startDate=2025-12-01T00:00:00Z&hasHit=true&page=1&limit=10" \
	-H "Authorization: Bearer <JWT_TOKEN>"
```

### Health Checks
```bash
curl http://localhost:8080/health                  # API Gateway
curl http://localhost:3002/health                  # Auth Service
curl http://localhost:3001/health                  # OP Adapter
curl http://localhost:3005/health                  # Core Service (debug)
```

### Response Example (Sanctions Check)
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
			"aliases": ["J. Doe"],
			"addresses": ["123 Main St, New York, NY"],
			"datasets": ["ofac-sdn"]
		}
	]
}
```

### Response Example (Audit History - Paginated)
```json
{
	"data": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"organizationId": "<org_id>",
			"userId": "<user_id>",
			"searchQuery": "John Doe",
			"hasHit": true,
			"hitsCount": 2,
			"createdAt": "2025-12-28T10:30:00Z"
		},
		{
			"id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
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