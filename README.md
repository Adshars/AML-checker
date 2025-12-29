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
	- Responsibilities: organization registration with API key generation, user registration, user login with JWT, API key validation (internal endpoint for API Gateway)
	- Endpoints: `/auth/register-organization`, `/auth/register-user`, `/auth/login`, `/auth/internal/validate-api-key`, `/health`
	- Generates API keys (`pk_live_...`) and secrets (`sk_live_...`); secrets hashed with bcryptjs

3. **Core Service** ([core-service/](core-service/)) – Sanctions checking and audit logging
	- Port: 3000 (mapped to 3005 for debug; accessed via API Gateway on production)
	- Database: PostgreSQL 15 (Sequelize 6 ORM)
	- Responsibilities: forward sanctions queries to OP Adapter, log audit trail, return history
	- Enforces organization-based data isolation: users see only their organization's logs
	- Endpoints: `/check` (sanctions check with audit), `/history` (audit log), `/health`

4. **OP Adapter** ([op-adapter/](op-adapter/)) – OpenSanctions Yente wrapper
	- Port: 3000 (mapped to 3001)
	- Responsibilities: translate HTTP requests into Yente API calls, map Yente responses to simplified format
	- Endpoints: `/check?name=<entity>` (sanctions/PEP check), `/health`
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
- **HTTP/Networking**: axios (inter-service calls), CORS middleware, http-proxy-middleware (reverse proxy)
- **Infrastructure**: Docker Compose 3.8, environment variables (.env)
- **Development**: nodemon (watch mode)

## Features
- **Organization & User Management**: 
	- Register organizations with automatic API key (`apiKey`, `apiSecret`) generation
	- Add users to organizations with role-based access (admin, user)
	- User login returning JWT token valid for 8 hours
	- API key validation for system-to-system (B2B) authentication

- **API Gateway & Authentication**:
	- Central API Gateway routing public (`/auth`) and protected (`/sanctions`) endpoints
	- Two authentication methods: JWT (user login) and API Key/Secret (B2B)
	- Automatic context header injection (`x-org-id`, `x-user-id`, `x-auth-type`) for downstream services
	- Organization-based isolation: users can only access their organization's data

- **Sanctions & PEP Screening**:
	- Real-time screening via GET `/sanctions/check?name=` against OpenSanctions data
	- Maps Yente results to simplified response with flags: `isSanctioned`, `isPep`
	- Returns entity details: name, schema (Person/Company), country, birth date, match score
	- Supports OFAC, UN, EU, and other sanctions lists via Yente

- **Audit Logging & Compliance**:
	- Automatic logging of all sanctions checks to audit table (PostgreSQL)
	- Audit log includes: organization ID, user ID, search query, hit status, hit count, timestamp
	- History endpoint to retrieve past screening queries per organization
	- Data isolation: organizations can only view their own audit logs

- **Health Checks & Monitoring**:
	- Health endpoints for each service with database connection status
	- Database health verification (MongoDB, PostgreSQL, Elasticsearch)
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
| `JWT_SECRET` | (required) | Secret key for signing JWT tokens; must be long and random |
| `GATEWAY_PORT` | 8080 | API Gateway external port |
| `PORT_AUTH` | 3002 | Auth Service external port |
| `YENTE_PORT` | 8000 | Yente API external port |
| `POSTGRES_PORT` | 5432 | PostgreSQL external port |
| `MONGO_PORT` | 27017 | MongoDB external port |
| `MONGO_INITDB_ROOT_PASSWORD` | (required) | MongoDB root password |
| `POSTGRES_PASSWORD` | (required) | PostgreSQL root password |
| `POSTGRES_DB` | core_db | PostgreSQL database name for Core Service |
| `AUTH_SERVICE_URL` | http://auth-service:3000 | API Gateway target for Auth Service |
| `CORE_SERVICE_URL` | http://core-service:3000 | API Gateway target for Core Service |
| `OP_ADAPTER_URL` | http://op-adapter:3000 | Reserved for downstream usage (not proxied directly) |
| `PORT` | 8080 | API Gateway listen port (inside container) |
| `JWT_SECRET` | (required) | JWT verification secret; must match Auth Service |

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

### 3. User Login (Get JWT Token)
```bash
curl -X POST http://localhost:8080/auth/login \
	-H "Content-Type: application/json" \
	-d '{
		"email": "admin@acme.test",
		"password": "Str0ngPass!"
	}'
```
**Response includes**:
- `token` – JWT valid for 8 hours (save as `<JWT_TOKEN>`)

### 4. Sanctions Check with JWT
```bash
curl -X GET "http://localhost:8080/sanctions/check?name=John%20Doe" \
	-H "Authorization: Bearer <JWT_TOKEN>" \
	-H "Content-Type: application/json"
```
**Response includes**:
- `hits_count` – number of matches found
- `data[]` – array of entities with `isSanctioned`, `isPep`, `score` flags

### 5. Sanctions Check with API Key (B2B)
```bash
curl -X GET "http://localhost:8080/sanctions/check?name=Jane%20Smith" \
	-H "x-api-key: <API_KEY>" \
	-H "x-api-secret: <API_SECRET>"
```

### 6. Retrieve Audit History
```bash
curl -X GET http://localhost:8080/sanctions/history \
	-H "Authorization: Bearer <JWT_TOKEN>"
```
**Response**: Array of recent sanctions checks for the organization (up to 50 most recent)

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
		"timestamp": "2025-12-28T10:30:45.123Z"
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
		}
	]
}
```

## Project Status
- **Status**: In progress (core platform complete, frontend and infrastructure pending)
- **Implemented & Running**:
	- ✅ OP Adapter (Yente wrapper)
	- ✅ Auth Service (organization/user management, JWT, API keys)
	- ✅ API Gateway (request routing, authentication enforcement)
	- ✅ Core Service (sanctions checking with audit logging)
	- ✅ MongoDB (Auth Service persistence)
	- ✅ PostgreSQL (Core Service audit logs)
	- ✅ Elasticsearch + Yente (sanctions data)
	- ✅ OpenAPI/Swagger docs for API Gateway (`/api-docs`)
- **Not Yet Implemented**:
	- ❌ Frontend (web UI for screening and organization management)
	- ❌ Infrastructure (Kubernetes manifests, Helm charts, CI/CD)
	- ❌ Rate limiting and comprehensive audit trail UI

## Room for Improvement
- **Security**: Add rate limiting on public endpoints (registration, login), implement request signing for B2B, add IP whitelisting
- **Features**: Add password reset flow, API key rotation, export audit logs, bulk entity screening, webhook notifications for high-risk matches
- **Architecture**: Add caching layer (Redis) for frequently checked names, implement request queuing for high-volume screening, add comprehensive logging/metrics (ELK stack, Prometheus)
- **Testing**: Write unit tests (Jest), integration tests (Postman/Newman), load tests (k6)
- **Frontend**: Build web UI for user/org management, screening dashboard, audit log viewer, analytics
- **Documentation**: Complete OpenAPI spec, deployment guide for Kubernetes/AWS, troubleshooting guide
- **Compliance**: Add compliance audit trail viewer, data retention policies, GDPR data deletion, role-based access control (RBAC)

## Acknowledgements
- **OpenSanctions** – provides open-source sanctions and PEP datasets via Yente API ([opensanctions.org](https://opensanctions.org))
- **Yente** – local API wrapper around OpenSanctions data ([yente-api.com](https://www.opensanctions.org/docs/yente/))
- **Elasticsearch** – search and analytics engine powering Yente

## Contact
**Repository**: [AML-Checker GitHub](https://github.com/your-org/AML-checker)