# AML Checker
> Microservice-based platform for automatic sanctions and PEP screening using a local OpenSanctions (Yente) instance. Includes organization/user management with JWT and API key authentication, API Gateway for request routing and authentication enforcement, and audit logging of all sanctions checks.

## Table of Contents
* [General Information](#general-information)
* [Architecture](#architecture)
* [API Endpoints Reference](#api-endpoints-reference)
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
	- **Architecture**: Class-based design (`GatewayServer`, `AuthMiddleware`) with dependency injection
	- Responsibilities: request routing (reverse proxy), authentication enforcement, header forwarding
	- **Route Security**: Protected endpoints (e.g., `/auth/register-user`) defined before public wildcards to ensure proper matching
	- Routes: `/auth/*` (public routes: login, register-org, forgot-password; protected routes: register-user [admin only], reset-secret [admin only]) → Auth Service; `/sanctions/*` (protected) → Core Service
	- Supports two authentication methods: JWT (user login) and API Key/Secret (B2B system-to-system)
	- **Performance**: API Key validation cached for 60 seconds (node-cache) - 60x faster than uncached validation
	- Adds context headers (`x-org-id`, `x-user-id`, `x-auth-type`, `x-role`) to downstream requests
	- OpenAPI docs: available at http://localhost:8080/api-docs

2. **Auth Service** ([auth-service/](auth-service/)) – User and organization management
	- Port: 3000 (mapped via `PORT_AUTH`, default 3002)
	- Database: MongoDB 6 (Mongoose 9 ORM)
	- Responsibilities: organization registration with API key generation, user registration (admin-only), user login with JWT access + refresh tokens, password reset flow, API key validation (internal endpoint for API Gateway)
	- **Security**: `/auth/register-user` requires admin authentication (defense in depth: gateway + service validation)
	- Endpoints: `/auth/register-organization`, `/auth/register-user` (protected), `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/reset-secret` (admin only), `/auth/internal/validate-api-key`, `/health`
	- Generates JWT tokens: `accessToken` (valid 15 minutes) and `refreshToken` (valid 7 days)
	- Generates API keys (`pk_live_...`) and secrets (`sk_live_...`); secrets hashed with bcryptjs
	- Supports three user roles: `superadmin`, `admin`, `user`

3. **Core Service** ([core-service/](core-service/)) – Sanctions checking and audit logging
	- Port: 3000 (mapped to 3005 for debug; accessed via API Gateway on production)
	- Database: PostgreSQL 15 (Sequelize 6 ORM)
	- Responsibilities: forward sanctions queries to OP Adapter, log audit trail, return history and statistics
	- Enforces organization-based data isolation: users see only their organization's logs
	- Endpoints: `/check` (sanctions check with audit), `/history` (audit log with advanced filtering), `/stats` (aggregated statistics), `/health`

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

6. **Frontend** ([frontend/](frontend/)) – React web application
	- Framework: React 19.2.0 with Vite 7.2.4 build system
	- UI Library: react-bootstrap 2.10.10 + Bootstrap 5.3.8 (responsive components)
	- Routing: react-router-dom 7.12.0 with nested routes
	- Testing: Vitest 2.1.5 + @testing-library/react 16.0.1 (27 tests covering services, context, components)
	- **Architecture**: MainLayout component with top navigation bar wrapping all authenticated pages
	- Pages (8 total): Login (public), CheckPage (sanctions screening), HistoryPage (audit log), UsersPage (admin panel), SettingsPage, DashboardPage, DeveloperPage, ResetPasswordPage
	- **Security**: Role-based navigation - Users page visible only for admin/superadmin roles
	- **Features**: Real-time entity screening with visual result cards (CLEAN/HIT status), paginated audit history, user management panel, modal interactions
	- Authentication: JWT tokens stored in localStorage, AuthContext for global state management, automatic redirect on authentication failure
	- API Integration: axios with interceptors for auth headers, centralized API service layer
	- Environment: VITE_API_URL configured to API Gateway (http://localhost:8080)
	- Language: English UI

7. **Data Stores**:
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

## API Endpoints Reference

All client requests go through **API Gateway** (port 8080). Below is a complete list of available endpoints:

### Authentication Endpoints (Auth Service via `/auth/*`)

| Method | Endpoint | Auth Required | Role Required | Description | Key Parameters |
|--------|----------|---------------|---------------|-------------|----------------|
| POST | `/auth/register-organization` | ❌ No | - | Register new organization with admin user | `orgName`, `country`, `city`, `address`, `email`, `password`, `firstName`, `lastName` |
| POST | `/auth/register-user` | ✅ JWT | admin/superadmin | Add user to organization | `email`, `password`, `firstName`, `lastName`, `organizationId` |
| POST | `/auth/login` | ❌ No | - | User login (returns JWT tokens) | `email`, `password` |
| POST | `/auth/refresh` | ❌ No | - | Refresh access token | `refreshToken` |
| POST | `/auth/logout` | ❌ No | - | Revoke refresh token | `refreshToken` |
| POST | `/auth/forgot-password` | ❌ No | - | Request password reset (sends email) | `email` |
| POST | `/auth/reset-password` | ❌ No | - | Reset password with token | `userId`, `token`, `newPassword` |
| POST | `/auth/change-password` | ✅ JWT | - | Change user password | `currentPassword`, `newPassword` |
| POST | `/auth/reset-secret` | ✅ JWT | admin/superadmin | Regenerate organization API secret | - |
| GET | `/auth/organization/keys` | ✅ JWT | - | Get organization API keys | - |
| POST | `/auth/internal/validate-api-key` | ❌ Internal | - | Validate API key (used by Gateway) | `apiKey`, `apiSecret` |
| GET | `/auth/health` | ❌ No | - | Health check | - |

### User Management Endpoints (Auth Service via `/users/*`)

| Method | Endpoint | Auth Required | Role Required | Description | Key Parameters |
|--------|----------|---------------|---------------|-------------|----------------|
| GET | `/users` | ✅ JWT | admin/superadmin | List all users in organization | - |
| POST | `/users` | ✅ JWT | admin/superadmin | Create new user in organization | `email`, `password`, `firstName`, `lastName` |
| DELETE | `/users/:id` | ✅ JWT | admin/superadmin | Delete user from organization | `id` (user ID in URL) |

### Sanctions Endpoints (Core Service via `/sanctions/*`)

| Method | Endpoint | Auth Required | Role Required | Description | Key Parameters |
|--------|----------|---------------|---------------|-------------|----------------|
| GET | `/sanctions/check` | ✅ JWT or API Key | - | Check entity against sanctions/PEP lists; creates audit log | `name` (required), `limit` (1-100, default 15), `fuzzy` (true/false), `schema` (Person/Company/etc), `country` (ISO code) |
| GET | `/sanctions/history` | ✅ JWT or API Key | - | Retrieve audit logs with pagination and advanced filtering | `page` (default 1), `limit` (default 20), `search` (text), `hasHit` (true/false), `startDate` (ISO), `endDate` (ISO), `userId` (UUID), `orgId` (superadmin only) |
| GET | `/sanctions/stats` | ✅ JWT or API Key | - | Get aggregated statistics for organization | - |
| GET | `/sanctions/health` | ❌ No | - | Health check | - |

### API Gateway Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/health` | ❌ No | API Gateway health check |
| GET | `/api-docs` | ❌ No | Swagger UI for API documentation |

### Authentication Methods

**1. JWT Authentication (User Login)**
- Header: `Authorization: Bearer <ACCESS_TOKEN>`
- Access token valid: 15 minutes
- Refresh token valid: 7 days
- Use `/auth/refresh` to get new access token before expiration

**2. API Key Authentication (B2B/System-to-System)**
- Headers:
  - `x-api-key: <API_KEY>` (format: `pk_live_...`)
  - `x-api-secret: <API_SECRET>` (format: `sk_live_...`)
- API keys generated during organization registration
- Secrets can be regenerated via `/auth/reset-secret` (admin only)
- Cached for 60 seconds in API Gateway for performance

### Rate Limiting

| Endpoint Pattern | Rate Limit | Window |
|------------------|------------|--------|
| `/auth/*` | 10 requests | 15 minutes |
| `/sanctions/*` | 100 requests | 15 minutes |

Rate limits applied per IP address. Returns `429 Too Many Requests` when exceeded.

### Context Headers (Injected by Gateway)

The API Gateway automatically adds these headers to downstream service requests after authentication:

- `x-org-id` – Organization ID (UUID)
- `x-user-id` – User ID (UUID) or `"API"` for API Key auth
- `x-auth-type` – `"JWT"` or `"API_KEY"`
- `x-role` – User role: `"superadmin"`, `"admin"`, or `"user"`

### Internal Endpoints (Not Exposed via Gateway)

**OP Adapter** (port 3001, Docker network only):
- `GET /check?name=<entity>&limit=<n>&fuzzy=<bool>&schema=<type>&country=<code>` – Yente API wrapper
- `GET /health` – Health check

**Yente** (port 8000, Docker network + localhost):
- `GET /search/default?q=<query>&limit=<n>&fuzzy=<bool>` – OpenSanctions search
- `GET /health` – Health check

## Technologies Used
- **Runtime**: Node.js 18, ES Modules
- **API Framework**: Express 5 (multiple microservices)
- **Frontend**: React 19.2.0, Vite 7.2.4, react-router-dom 7.12.0, react-bootstrap 2.10.10, Bootstrap 5.3.8, axios 1.13.2, AuthContext
- **Frontend Testing**: Vitest 2.1.5, @testing-library/react 16.0.1, @testing-library/jest-dom 6.1.5, jsdom 25.0.1
- **Databases**: 
	- MongoDB 6 (Mongoose 9 ORM) for Auth Service
	- PostgreSQL 15 (Sequelize 6 ORM) for Core Service
	- Elasticsearch 8.11 for Yente
- **Sanctions Data**: OpenSanctions Yente 5.1 (local instance)
- **Authentication**: bcryptjs (password/secret hashing), jsonwebtoken (JWT), API Key validation
- **Caching**: node-cache (in-memory caching for API key validation; 60s TTL)
- **Validation**: joi (request payload validation for email format, password strength)
- **Rate Limiting**: express-rate-limit (per-IP request throttling for auth and API endpoints)
- **Email Service**: nodemailer (SMTP email sending), Ethereal Email (free SMTP for testing/development)
- **HTTP/Networking**: axios (inter-service calls), CORS middleware, http-proxy-middleware (reverse proxy)
- **Infrastructure**: Docker Compose 3.8, environment variables (.env)
- **Development**: nodemon (watch mode), Vitest (frontend testing)

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
	- **User Management (Admin)**: List users (`GET /users`), create users (`POST /users`), delete users (`DELETE /users/:id`) with organization isolation and self-deletion prevention
	- **Request validation** using Joi: email format validation, password minimum 8 characters for registration and password reset
	- **Welcome Emails**: 
		- Sent automatically when registering new organization (welcome email to admin with login instructions and API credentials)
		- Sent automatically when creating new user in organization (welcome email to new user with login instructions)
		- Sent automatically when registering user via SuperAdmin panel (welcome email with login credentials)
		- Uses nodemailer with Ethereal SMTP for testing/development (non-blocking, logged but doesn't fail API calls if email fails)

- **API Gateway & Authentication**:
	- **Class-based architecture**: GatewayServer and AuthMiddleware classes with dependency injection
	- Central API Gateway routing public and protected endpoints
	- Two authentication methods: JWT (user login) and API Key/Secret (B2B)
	- **Defense in depth security**: Protected endpoints require authentication at gateway level + role validation at service level
	- **Performance optimization**: API Key validation cached for 60 seconds (60x faster) using node-cache
	- **Rate limiting**: 10 requests per 15 minutes for auth endpoints, 100 requests per 15 minutes for API endpoints (per IP address)
	- **Route security**: `/auth/register-user` protected (admin-only), defined before public wildcards for proper Express matching
	- Automatic context header injection (`x-org-id`, `x-user-id`, `x-auth-type`, `x-role`) for downstream services
	- Organization-based isolation: users can only access their organization's data
	- Superadmin access: superadmin users can access all organizations' audit logs

- **Sanctions & PEP Screening**:
	- Real-time screening via GET `/sanctions/check?name=` against OpenSanctions data
	- **Configurable search parameters**: `limit` (default 15), `fuzzy` (default false), `schema` (filter by entity type), `country` (filter by country code)
	- Maps Yente results to simplified response with flags: `isSanctioned`, `isPep`
	- Returns entity details: name, schema (Person/Company), country, birth date, birthplace, gender, nationality, position, notes, alias, address, match score
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
	- API Key validation caching in API Gateway (60s TTL) reduces load on Auth Service
	- Health checks for all services with database connection status
	- Docker health checks for container orchestration

- **Web Frontend**:
	- React-based single-page application with professional layout
	- **MainLayout**: Top navigation bar with role-based menu items (Users page visible only for admins)
	- **Authentication flow**: Login page → JWT token storage → protected routes with automatic redirect
	- **Entity Screening Panel**: Real-time sanctions checking with visual result cards (CLEAN/HIT status)
	- **Audit History**: Paginated view of organization's sanctions checks with advanced filtering (search, date range, hit status, user)
	- **Dashboard**: Analytics with charts displaying total checks, sanction hits, PEP hits, and recent activity
	- **User Management**: Admin panel for listing users, creating users, and deleting users from organization (admin-only) with self-deletion prevention
	- **Settings Page**: Change password functionality and account configuration
	- **Developer Page**: API key management and developer tools
	- Responsive design with react-bootstrap components
	- English UI with clear labeling and user feedback

## Testing

The project includes comprehensive test suites for all microservices and frontend with **130 total tests** covering integration, E2E, data mapping, error handling, security scenarios, and UI components.

### Running All Tests
```bash
npm test
```
This runs tests for all microservices and frontend sequentially:
- `npm run test:auth` – Auth Service (31 tests)
- `npm run test:core` – Core Service (34 tests)
- `npm run test:adapter` – OP Adapter (35 tests)
- `npm run test:gateway` – API Gateway (3 tests)
- `npm run test:frontend` – Frontend (27 tests)

### Test Suites Overview

| Service | Tests | Focus Areas |
|---------|-------|------------|
| **auth-service** | 31 | Registration flows, user login, token refresh, logout, password reset, API key validation, email validation, role-based access |
| **core-service** | 34 | Parameter validation, org context enforcement, audit logging, pagination, data isolation, advanced filtering (search, date range, hasHit, userId) |
| **op-adapter** | 35 | DTO mapping, error handling, limit validation (clamping), boolean conversion (toBoolean), parameter forwarding, response structure |
| **api-gateway** | 3 | Rate limiting enforcement (429), request routing to microservices |
| **frontend** | 27 | API service (2), Auth service (9), AuthContext (5), ScreeningPanel component (11) - including form submission, validation, modal interaction |

### Test Framework & Tools
- **Backend**: Jest 30.2.0 with ES Modules support (`cross-env NODE_OPTIONS=--experimental-vm-modules jest --verbose`)
- **Frontend**: Vitest 2.1.5 with jsdom environment, @testing-library/react 16.0.1 for component testing
- **HTTP Testing**: Supertest for backend API endpoints
- **Mocking**: jest.unstable_mockModule (backend module mocking), vi.mock (Vitest mocking), nock (HTTP interception)
- **Isolation**: All tests run with mocked external dependencies (no real database, service calls, or API requests required)

### Running Tests for Individual Services
```bash
# Auth Service
cd auth-service && npm test

# Core Service
cd core-service && npm test

# OP Adapter
cd op-adapter && npm test

# API Gateway
cd api-gateway && npm test

# Frontend
cd frontend && npm test
```

For detailed information about each test suite, see the Testing section in individual service README files:
- [auth-service/README.md](auth-service/README.md#testing)
- [core-service/README.md](core-service/README.md#testing)
- [op-adapter/README.md](op-adapter/README.md#testing)
- [api-gateway/README.md](api-gateway/README.md#testing)
- [frontend/README.md](frontend/README.md#testing)

## Setup

### Requirements
- Docker + Docker Compose (for containerized stack)
- Node.js 18 (optional; for running services locally without Docker)
- MongoDB CLI (`mongosh`) for initial SuperAdmin setup (can be run inside container)

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

### Initial Setup (Creating the First SuperAdmin)

By default, public registration is disabled for security reasons. To access the system, you must manually create the initial SuperAdmin account directly in the MongoDB database (Seeding).

**Follow these steps to create your "God Mode" account:**

#### 1. Access the MongoDB Container
Open your terminal and enter the MongoDB container:
```bash
docker exec -it mongo-1 mongosh
```

#### 2. Switch to the Auth Database
Select the database used by the Auth Service:
```javascript
use auth_db
```

#### 3. Run the Seeding Script
Copy and paste the following JavaScript code into the mongosh terminal. This will create a system organization and the SuperAdmin user:

**Default Credentials:**
- Email: `super@admin.com`
- Password: `admin123`

```javascript
// 1. Generate a new Organization ID
var orgId = new ObjectId();

// 2. Create the System Organization
db.organizations.insertOne({
    _id: orgId,
    name: "AML System Corp",
    country: "Global",
    city: "System",
    address: "Root Level",
    apiKey: "sys-" + Math.random().toString(36).substring(7),
    createdAt: new Date(),
    updatedAt: new Date()
});

// 3. Create the SuperAdmin User
db.users.insertOne({
    email: "super@admin.com",
    // Bcrypt hash for password: "admin123"
    passwordHash: "$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa",
    firstName: "System",
    lastName: "SuperAdmin",
    role: "superadmin",
    organizationId: orgId,
    createdAt: new Date()
});

print("✅ SuperAdmin created successfully!");
```

#### 4. Verify SuperAdmin Creation
```javascript
// List all users to verify
db.users.find();
```

You should see the SuperAdmin user with `role: "superadmin"`.

#### 5. Login to System
1. Navigate to http://localhost:5173 (or your frontend URL)
2. Click on **Login**
3. Enter the default credentials:
   - Email: `super@admin.com`
   - Password: `admin123`
4. You will be redirected to the **SuperAdmin Portal** where you can register other organizations

#### 6. Change Default Password (Important!)
After logging in with the default SuperAdmin account:
1. Go to **Settings** page
2. Click **Change Password**
3. Enter the current password (`admin123`)
4. Set a strong new password
5. Save the changes

**Important Security Notes:**
- ⚠️ Change the default SuperAdmin password immediately in production
- ⚠️ The SuperAdmin can register organizations and create other admins - use this account carefully
- 🔒 Store SuperAdmin credentials in a secure password manager
- 📋 Consider creating additional SuperAdmin accounts for backup/rotation purposes

#### Troubleshooting

**MongoDB connection refused?**
Make sure MongoDB container is running: `docker compose ps`

**Cannot find mongosh command?**
Install MongoDB Shell: https://www.mongodb.com/try/download/shell or use MongoDB Compass GUI.

**Wrong password hash?**
The provided hash is for password `admin123` using bcryptjs with 10 rounds. To use a different password, generate a bcrypt hash:
```bash
# Using Node.js
node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"
```

**Need to reset SuperAdmin account?**
Delete the user and organization from MongoDB and re-run the seeding script:
```javascript
db.users.deleteMany({ email: "super@admin.com" });
db.organizations.deleteMany({ name: "AML System Corp" });
// Then re-run seeding script above
```

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

### Email Service Configuration

The system sends emails via **nodemailer** for password resets and welcome notifications. By default, development environments use **Ethereal Email** (free, disposable SMTP service for testing).

#### Default Configuration (Development)

For development/testing, the Auth Service automatically uses Ethereal Email (no configuration needed):
- Emails are sent but not to real addresses (safe for testing)
- Ethereal creates test email accounts on demand
- Email preview URLs are logged in the terminal
- See logs for links to view sent emails

Example log output:
```
✉️  Password reset email sent successfully
   Preview URL: https://ethereal.email/message/...
```

#### Production Email Configuration

For production, configure real SMTP credentials in `.env`:

```bash
# Real SMTP Server (Gmail, SendGrid, AWS SES, etc.)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

Then update `auth-service/src/utils/emailSender.js` to use environment variables instead of Ethereal.

#### Email Templates

The system sends emails for:

1. **Welcome Email (Organization Registration)**
   - Triggered: When SuperAdmin registers new organization via `/auth/register-organization`
   - Recipient: Organization admin
   - Content: Login credentials, API key management instructions, next steps
   - Subject: "Welcome to AML Checker"

2. **Welcome Email (User Registration)**
   - Triggered: When admin creates new user via `/auth/register-user` or `/users`
   - Recipient: New user
   - Content: Login credentials, password change instructions
   - Subject: "Welcome to AML Checker"

3. **Password Reset Email**
   - Triggered: When user requests password reset via `/auth/forgot-password`
   - Recipient: User email
   - Content: Reset link with token, token valid for 1 hour
   - Subject: "Password Reset Request"

#### Testing Emails

To view sent emails during development:

1. Run the application
2. Perform an action that sends email (register organization, reset password, etc.)
3. Check terminal logs for Ethereal preview URL
4. Click the link to view the email in browser (HTML rendering)
5. Inspect email content, links, formatting

#### Troubleshooting

**Emails not sending?**
- Check logs: `docker compose logs auth-service`
- Verify SMTP credentials (development uses Ethereal, no config needed)
- Check network connectivity to SMTP server (production)
- Ensure sender email address is valid

**Email links broken?**
- Verify `FRONTEND_URL` environment variable is set to your frontend URL
- Example: `FRONTEND_URL=http://localhost:5173`
- Password reset links use this URL to construct reset token link

**Want to disable emails?**
- For testing purposes, emails are non-blocking (API calls succeed even if email fails)
- Email errors are logged but don't affect user experience
- To disable, remove the `sendWelcomeEmail()` and `sendPasswordResetEmail()` calls from controllers

## Usage

### Quick Navigation

1. **First Time Setup**: [Create SuperAdmin Account](#initial-setup-creating-the-first-superadmin)
2. **SuperAdmin Tasks**: Register new organizations → Manage API credentials
3. **Admin Tasks**: Create users in organization → Delete users → Reset API secret
4. **User Tasks**: Login → Perform sanctions screening → View audit history
5. **API Integration**: Use API keys for system-to-system (B2B) authentication

### 1. Register Organization (SuperAdmin Portal or API)
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

### 2. Register Additional User (Admin Only)
```bash
curl -X POST http://localhost:8080/auth/register-user \
	-H "Authorization: Bearer <ACCESS_TOKEN>" \
	-H "Content-Type: application/json" \
	-d '{
		"email": "user@acme.test",
		"password": "Str0ngPass!",
		"firstName": "Jane",
		"lastName": "Doe",
		"organizationId": "<ORG_ID>"
	}'
```
**Note**: This endpoint requires authentication. Only users with `admin` or `superadmin` role can register new users.
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
cur

### 9. Get Organization Statistics
```bash
curl10. User Management (Admin Only)
```bash
# List all users in organization
curl -X GET http://localhost:8080/users \
	-H "Authorization: Bearer <ADMIN_JWT_TOKEN>"

# Create new user in organization
curl -X POST http://localhost:8080/users \
	-H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
	-H "Content-Type: application/json" \
	-d '{
		"email": "newuser@acme.test",
		"password": "Str0ngPass!",
		"firstName": "Alice",
		"lastName": "Johnson"
	}'

# Delete user from organization (prevents self-deletion)
curl -X DELETE http://localhost:8080/users/<USER_ID> \
	-H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```

### 11. Change Password
```bash
curl -X POST http://localhost:8080/auth/change-password \
	-H "Authorization: Bearer <JWT_TOKEN>" \
	-H "Content-Type: application/json" \
	-d '{
		"currentPassword": "OldPassword123",
		"newPassword": "NewStr0ngPass!"
	}'
```

### 12. Get Organization API Keys
```bash
curl -X GET http://localhost:8080/auth/organization/keys \
	-H "Authorization: Bearer <JWT_TOKEN>"
```
**Response includes**:
- `apiKey` – public API key (format: `pk_live_...`)

###  -X GET http://localhost:8080/sanctions/stats \
	-H "Authorization: Bearer <JWT_TOKEN>"
```
**Response includes**:
- `totalChecks` – total number of sanctions checks for organization
- `sanctionHits` – number of checks with sanctioned entities
- `pepHits` – number of checks with PEP entities
- `recentLogs` – last 100 audit logs with basic detailsl -X GET "http://localhost:8080/sanctions/history?search=John&startDate=2025-12-01T00:00:00Z&hasHit=true&page=1&limit=10" \
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
	"quentityName": "John Doe",
			"entityScore": 0.98,
			"isSanctioned": true,
			"isPep": false,
			"createdAt": "2025-12-28T10:30:00Z"
		},
		{
			"id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
			"organizationId": "<org_id>",
			"userId": "API",
			"searchQuery": "Jane Smith",
			"hasHit": false,
			"hitsCount": 0,
			"entityName": null,
			"entityScore": null,
			"isSanctioned": false,
			"isPep": false
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
			"notes": ["U.S. OFAC Sanctions List"],
			"alias": ["J. Doe"],
			"address": ["123 Main St, New York, NY"],
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
			"userId": "API",
			"searchQuery": "Jane Smith",
			"hasHit": false,
			"hitsCount": 0,
			"createdAt": "2025-12-28T10:25:00Z"
		}
	],

### Response Example (Organization Statistics)
```json
{
	"totalChecks": 150,
	"sanctionHits": 25,
	"pepHits": 10,
	"recentLogs": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"searchQuery": "John Doe",
			"isSanctioned": true,
			"isPep": false,
			"createdAt": "2025-12-28T10:30:00Z"
		},
		{
			"id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
			"searchQuery": "Jane Smith",
			"isSanctioned": false,
			"isPep": false,
			"createdAt": "2025-12-28T10:25:00Z"
		}
	]
}
```

## Acknowledgements
- OpenSanctions project ([opensanctions.org](https://www.opensanctions.org/)) for providing comprehensive sanctions and PEP data.
- Yente API ([github.com/opensanctions/yente](https://github.com/opensanctions/yente)) for the local sanctions API implementation.
- All open-source libraries and frameworks used in this project.

## Contact
Created by Adam Węglewski - feel free to contact me!

## License
This project is open source and available under the [MIT License](LICENSE).
	"meta": {
		"totalItems": 150,
		"totalPages": 8,
		"currentPage": 1,
		"itemsPerPage": 20
	}
}
```