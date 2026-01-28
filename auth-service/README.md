Auth-Service
============

Authentication and registration service for organizations and users in the AML Checker platform. Generates API keys (apiKey, apiSecret) for organizations, stores data in MongoDB, and provides health-check endpoint.

Stack and Dependencies
- Node.js 18, Express 5, ES Modules
- Mongoose 9 + MongoDB 6
- bcryptjs (password and apiSecret hashing), jsonwebtoken (JWT authentication), cors, dotenv
- express-rate-limit (endpoint rate limiting), nodemailer (password reset emails)
- joi (request payload validation: email format, password rules)
- winston + winston-daily-rotate-file (structured logging with file rotation)
- jest + supertest (dev dependencies for integration testing)
- cross-env (dev dependency for cross-platform environment variables)

Environment and Configuration
- `MONGO_URI` – MongoDB connection string; defaults to `mongodb://localhost:27017/auth_db` in code.
- In docker-compose, MONGO_URI is built from `.env` variables (username, password, port, database).
- `JWT_SECRET` – secret key for JWT access token signing (required for login functionality).
- `REFRESH_TOKEN_SECRET` – secret key for refresh token signing (required for token refresh functionality).
- `FRONTEND_URL` – frontend URL for password reset links; defaults to `http://localhost:3000`.
- Application port: 3000 (default in code; docker-compose may map externally).

Local Setup
1) `npm install`
2) `node src/index.js` (optionally set `MONGO_URI`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `FRONTEND_URL`)
3) `npm test` (for running integration tests)

Docker Compose Setup
- From project root directory: `docker compose up --build auth-service`
- Endpoints will be available at http://localhost:3002 (port mapping handled by docker-compose).

Endpoints
---------

### Service Endpoints

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/health` | ❌ No | - | Returns service status and MongoDB connection state |

### Authentication Endpoints (`/auth/*`)

#### Public Endpoints (No Authentication Required)

| Method | Endpoint | Rate Limit | Description | Required Fields |
|--------|----------|------------|-------------|-----------------|
| POST | `/auth/login` | 50 req/15min | User login; returns JWT access token (15min) + refresh token (7d) | `email`, `password` |
| POST | `/auth/refresh` | None | Generate new access token using valid refresh token | `refreshToken` |
| POST | `/auth/logout` | None | Revoke refresh token from database | `refreshToken` |
| POST | `/auth/forgot-password` | None | Request password reset email with token (valid 1 hour) | `email` |
| POST | `/auth/reset-password` | None | Reset password using token from email | `userId`, `token`, `newPassword` |

#### Protected Endpoints (Authentication Required)

| Method | Endpoint | Auth Required | Role Required | Description | Required Fields |
|--------|----------|---------------|---------------|-------------|-----------------|
| POST | `/auth/register-organization` | ✅ JWT | superadmin | Register new organization with admin user; generates API key/secret; sends welcome email to admin | `orgName`, `country`, `city`, `address`, `email`, `password`, `firstName`, `lastName` |
| POST | `/auth/register-user` | ✅ JWT | admin/superadmin | Add user to organization (role forced to 'user'); sends welcome email | `email`, `password`, `firstName`, `lastName`, `organizationId` |
| POST | `/auth/reset-secret` | ✅ JWT | admin/superadmin | Reset organization's API secret; requires password confirmation | `password` |
| POST | `/auth/change-password` | ✅ JWT | - | Change authenticated user's password | `currentPassword`, `newPassword` |
| GET | `/auth/organization/keys` | ✅ JWT | - | Get organization's public API key | - |

#### Internal Endpoints (Not Exposed via Gateway)

| Method | Endpoint | Description | Required Fields |
|--------|----------|-------------|-----------------|
| POST | `/auth/internal/validate-api-key` | Validate API key/secret for API Gateway (B2B auth) | `apiKey`, `apiSecret` |

### Users Management Endpoints (`/users/*`)

All users management endpoints require **JWT authentication** with **admin or superadmin role** and **organization context** (via `x-org-id`, `x-user-id`, `x-role` headers from API Gateway).

| Method | Endpoint | Description | Required Fields | Security Features |
|--------|----------|-------------|-----------------|-------------------|
| GET | `/users` | List all regular users in organization | - | Returns only users with role='user' (hides admins); organization data isolation |
| POST | `/users` | Create new user in organization; sends welcome email | `email`, `password`, `firstName`, `lastName` | **Role forced to 'user'** (prevents admin creation); organizationId auto-assigned from admin context |
| DELETE | `/users/:id` | Delete user from organization | - | Prevents self-deletion; organization data isolation; only superadmins can delete admins |

### Endpoint Details

**Authentication & Authorization:**
- JWT tokens contain: `userId`, `organizationId`, `role`, `email`
- Access token validity: 15 minutes
- Refresh token validity: 7 days
- Rate limiting: 50 req/15min for login endpoint (express-rate-limit)

**Validation Rules (Joi):**
- Email: valid format with `@` and domain
- Password: minimum 8 characters
- All required fields validated before processing

**Error Responses:**
- 400: Validation errors, duplicate entries, missing fields
- 401: Invalid credentials, expired tokens
- 403: Insufficient permissions, missing role/organization context
- 404: Resource not found (user, organization, token)
- 500: Server errors

**Security Features:**
- Passwords hashed with bcryptjs (salt rounds: 10)
- API secrets hashed with bcryptjs (never stored in plaintext)
- JWT verification for protected endpoints
- Organization-based data isolation
- Role-based access control (RBAC)
- Self-deletion prevention
- Admin role elevation prevention (forced user role in POST /users)

Usage Examples
- Health check:
```bash
curl http://localhost:3002/health
```

- Organization + admin registration (requires **SuperAdmin authentication**):
```bash
curl -X POST http://localhost:3002/auth/register-organization \
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
Registers organization and creates admin user. **Sends welcome email to admin with login instructions.**

- User login:
```bash
curl -X POST http://localhost:3002/auth/login \
	-H "Content-Type: application/json" \
	-d '{
		"email": "admin@acme.test",
		"password": "Str0ngPass!"
	}'
```
Returns both `accessToken` (15 min) and `refreshToken` (7 days).

- User registration (requires **admin authentication**):
```bash
curl -X POST http://localhost:3002/auth/register-user \
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
Only users with `admin` or `superadmin` role can register new users to the organization. **Sends welcome email to new user with login instructions.**

- Refresh access token:
```bash
curl -X POST http://localhost:3002/auth/refresh \
	-H "Content-Type: application/json" \
	-d '{
		"refreshToken": "<REFRESH_TOKEN_FROM_LOGIN>"
	}'
```

- User logout (revoke refresh token):
```bash
curl -X POST http://localhost:3002/auth/logout \
	-H "Content-Type: application/json" \
	-d '{
		"refreshToken": "<REFRESH_TOKEN>"
	}'
```

- Request password reset (public, no auth required):
```bash
curl -X POST http://localhost:3002/auth/forgot-password \
	-H "Content-Type: application/json" \
	-d '{
		"email": "admin@acme.test"
	}'
```
Sends password reset email with 1-hour token link.

- Reset password (using token from email):
```bash
curl -X POST http://localhost:3002/auth/reset-password \
	-H "Content-Type: application/json" \
	-d '{
		"userId": "<USER_ID>",
		"token": "<TOKEN_FROM_EMAIL>",
		"newPassword": "NewStr0ngPass!"
	}'
```

- Reset organization API secret (admin only, requires JWT auth and password verification):
```bash
curl -X POST http://localhost:8080/auth/reset-secret \
	-H "Authorization: Bearer <JWT_TOKEN>" \
	-H "Content-Type: application/json" \
	-d '{
		"password": "YourCurrentPassword123"
	}'
```
Returns new `apiSecret` (plaintext, visible only once).

- Get organization's public API key (requires authentication):
```bash
curl -X GET http://localhost:8080/auth/organization/keys \
	-H "Authorization: Bearer <JWT_TOKEN>"
```
Returns `{ "apiKey": "pk_live_..." }`.

- Change authenticated user's password:
```bash
curl -X POST http://localhost:8080/auth/change-password \
	-H "Authorization: Bearer <JWT_TOKEN>" \
	-H "Content-Type: application/json" \
	-d '{
		"currentPassword": "OldPassword123",
		"newPassword": "NewStr0ngPass!"
	}'
```
Returns success message.

- Get all users in organization (admin only):
```bash
curl -X GET http://localhost:8080/users \
	-H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```
Returns array of users (role='user' only) from admin's organization.

- Create new user in organization (admin only):
```bash
curl -X POST http://localhost:8080/users \
	-H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
	-H "Content-Type: application/json" \
	-d '{
		"email": "newuser@acme.test",
		"password": "Str0ngPass!",
		"firstName": "Alice",
		"lastName": "Johnson"
	}'
```
Creates user with role='user' in admin's organization. **Sends welcome email to new user with login instructions.**

- Delete user from organization (admin only):
```bash
curl -X DELETE http://localhost:8080/users/<USER_ID> \
	-H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```
Deletes user (prevents self-deletion, requires organization match).

Response Structure (examples)
- `/health`:
```json
{ "service": "auth-service", "status": "UP", "database": "Connected" }
```

- `/auth/register-organization`:
```json
{
	"message": "Organization registered successfully",
	"organization": {
		"id": "<org_id>",
		"name": "ACME Corp",
		"location": "Warsaw, PL",
		"apiKey": "pk_live_...",
		"apiSecret": "sk_live_..."   // returned only once
	},
	"user": {
		"id": "<user_id>",
		"fullName": "John Smith",
		"email": "admin@acme.test",
		"role": "admin"
	}
}
```

- `/auth/login`:
```json
{
	"message": "Login successful",
	"accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
	"refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
	"user": {
		"id": "<user_id>",
		"email": "admin@acme.test",
		"role": "admin",
		"firstName": "John",
		"lastName": "Smith",
		"organizationId": "<org_id>"
	}
}
```

- `/auth/internal/validate-api-key`:
```json
{
	"valid": true,
	"organizationId": "<org_id>",
	"organizationName": "ACME Corp"
}
```

How It Works (High Level)
- `register-organization`: validates required fields, checks for duplicate org name and email, generates `apiKey` (format: `pk_live_<random>`) and `apiSecret` (format: `sk_live_<random>`), hashes apiSecret and password using bcryptjs (salt 10), saves Organization with hashed secret, creates admin User associated with organization, **sends welcome email to admin (non-blocking)**, returns organization and user details with **plaintext apiSecret visible only once**.
- `register-user`: validates required fields and checks organizationId existence, verifies email uniqueness, hashes password using bcryptjs (salt 10), saves User with role `user` and association to organization, **sends welcome email to new user (non-blocking)**.
- `login`: finds user by email, compares password against hash using bcryptjs, generates `accessToken` (15 min, payload `{ userId, organizationId, role }`) signed with `JWT_SECRET`, generates `refreshToken` (7 days) signed with `REFRESH_TOKEN_SECRET`, stores refreshToken in DB, returns both tokens and user info. **Rate limited to 50 requests per 15 minutes per IP.**
- `refresh`: validates refreshToken exists in DB (not revoked) and passes cryptographic verification, fetches user (for current role), generates new `accessToken` (15 min).
- `logout`: deletes refreshToken from database; user cannot refresh access token after this call.
- `forgot-password`: finds user by email, generates random reset token, stores token in DB (expires 1 hour), sends email with reset link including token and userId. **Always returns success message to prevent account enumeration.**
- `reset-password`: finds PasswordResetToken by userId, verifies token matches, hashes new password using bcryptjs (salt 10), updates User passwordHash, deletes used token from DB.
- `change-password`: requires authentication via `x-user-id` header (from API Gateway), verifies current password against user's hash using bcryptjs, hashes new password (salt 10), updates User passwordHash, returns success message.
- `reset-secret`: requires `admin` role (via `x-role` header from API Gateway) and user's current password for verification, compares password against user's hash using bcryptjs, generates new `apiSecret`, hashes and stores it, returns new credentials plaintext.
- `getOrganizationKeys`: requires authentication via `x-org-id` and `x-user-id` headers (from API Gateway), finds organization by ID, returns public `apiKey` (not secret).
- `/auth/internal/validate-api-key`: finds organization by apiKey, compares provided plaintext apiSecret against stored hash using bcryptjs, returns organization ID and name on success (used by API Gateway for B2B authentication).
- `GET /users`: requires `admin` or `superadmin` role (via `x-role` header) and organization context (via `x-org-id` header), queries User collection filtered by organizationId and role='user' (hides admins/superadmins), returns array of users with passwordHash excluded.
- `POST /users`: requires `admin` or `superadmin` role (via `x-role` header) and organization context (via `x-org-id` header), **forces role to 'user'** (prevents role elevation), validates email uniqueness, hashes password using bcryptjs (salt 10), creates User with forced organizationId from admin's context, **sends welcome email to new user (non-blocking)**, returns created user details.
- `DELETE /users/:id`: requires `admin` or `superadmin` role (via `x-role` header) and organization context (via `x-org-id` header), prevents self-deletion, verifies user belongs to admin's organization (data isolation), only superadmins can delete admin users, deletes user from database.
- `/health`: reports service status and Mongoose connection state (1 = Connected, other = Disconnected).

Validation Rules (Joi)
- Email: must be a valid email address (contains `@` and a domain with a dot); required.
- Password: minimum 8 characters; required for registration and login; enforced for `newPassword` during reset.
- Required fields: all listed required fields are validated via Joi schemas; errors return `400` with descriptive messages.

Authentication Methods
- **User Login (JWT)**: User provides email and password → receives `accessToken` (15 min) and `refreshToken` (7 days) → uses accessToken in `Authorization: Bearer <token>` header for API calls → API Gateway verifies token signature → when accessToken expires, client uses refreshToken to obtain new accessToken → on logout, refreshToken is revoked and cannot be used.
- **System/B2B (API Key)**: Organization receives `apiKey` and `apiSecret` at registration → uses both in `x-api-key` and `x-api-secret` headers → API Gateway validates credentials with `/auth/internal/validate-api-key` endpoint → no token expiration (persistent until reset via `/reset-secret`).
- **Role-Based Access**: Tokens include user role (`superadmin`, `admin`, `user`) → API Gateway forwards role via `x-role` header → services can enforce access control (e.g., `/reset-secret` requires admin role).

Data Models
- **Organization**: { name (unique), country, city, address, apiKey (unique, format: pk_live_...), apiSecretHash (bcrypt), createdAt }
- **User**: { email (unique, lowercase), passwordHash (bcrypt, salt 10), firstName, lastName, organizationId (references Organization), role (superadmin|admin|user), createdAt }
- **PasswordResetToken**: { userId (references User), token (random string), createdAt (expires after 1 hour via TTL index) }
- **RefreshToken**: { token (JWT), userId (references User), createdAt (expires after 7 days via TTL index) }

Implemented Features
- ✅ **Rate Limiting**: `/login` endpoint limited to 50 requests per 15 minutes per IP (express-rate-limit).
- ✅ **Password Reset Flow**: `forgot-password` (send email) and `reset-password` (token-based reset) with 1-hour token expiration.
- ✅ **Welcome Emails**: Automatic welcome email sent to newly registered users (organization admins, regular users) with login instructions and role information via nodemailer (non-blocking).
- ✅ **Password Change**: `/change-password` endpoint for authenticated users to change their password with current password verification.
- ✅ **Token Refresh/Revocation**: `refresh` endpoint for new access tokens; `logout` endpoint revokes refresh tokens from database.
- ✅ **Role-Based Access Control (RBAC)**: `superadmin`, `admin`, and `user` roles supported; `/reset-secret` requires `admin` role; users management requires `admin` or `superadmin` role.
- ✅ **Users Management (Admin)**: `GET /users` lists organization users; `POST /users` creates users (role forced to 'user'); `DELETE /users/:id` removes users with organization isolation.
- ✅ **Structured Logging**: winston with daily rotation for all authentication events, errors, and audit trails.
- ✅ **API Secret Reset**: `/reset-secret` endpoint allows admins to regenerate organization API credentials (requires password confirmation).
- ✅ **Organization Keys Retrieval**: `GET /auth/organization/keys` returns public API key for authenticated users.
- ✅ **Schema Validation (Joi)**: email format and password minimum length enforced for registration, login, reset-password, and user creation.
- ✅ **Data Isolation**: All users management operations verify organization context; admins can only manage users from their own organization.
- ✅ **Security Controls**: Self-deletion prevention, role elevation prevention (admins cannot create other admins), password verification for sensitive operations.

Testing
-------

Integration tests for Auth Service verify endpoint behavior, request validation, authentication flows, role-based access control, and interaction with external dependencies (MongoDB, email service). Tests use Jest test framework with Supertest for HTTP testing and mock external dependencies.

Test Files
- `tests/auth.test.js` – comprehensive integration tests for all authentication and users management endpoints (31 tests total).
	- **Organization Registration** (`POST /auth/register-organization` - 3 tests):
		- Happy path: successful organization and admin user registration with API key generation (201).
		- Duplicate email validation: rejects duplicate email registrations (400).
		- Password validation: enforces minimum 8-character password requirement via Joi (400).
	- **User Registration** (`POST /auth/register-user` - 5 tests):
		- Success: registers user with admin authorization (201).
		- Rejects registration without admin role (403).
		- Validates duplicate email, missing organization ID, and required fields (400/404).
	- **User Login** (`POST /auth/login` - 2 tests):
		- Success: authenticates user and returns JWT access token and refresh token (200).
		- Failure: rejects invalid credentials with 401 error.
	- **Token Refresh** (`POST /auth/refresh` - 2 tests):
		- Success: generates new access token using valid refresh token stored in database (200).
		- Failure: rejects invalid, expired, or revoked refresh tokens with 403 error.
	- **User Logout** (`POST /auth/logout` - 2 tests):
		- Success: revokes refresh token from database, preventing future token refreshes (200).
		- Rejects refresh attempts with revoked token (403 after logout).
	- **API Key Validation** (`POST /auth/internal/validate-api-key` - 4 tests):
		- Success: validates correct API key and secret pair (200).
		- Rejects invalid API key, invalid secret, and missing credentials (400/401).
	- **API Secret Reset** (`POST /auth/reset-secret` - 3 tests):
		- Success: generates new API secret for organization (200).
		- Rejects non-admin users (403).
		- Validates missing context headers (401).
	- **Password Reset Flow** (`POST /auth/forgot-password` - 2 tests; `POST /auth/reset-password` - 3 tests):
		- Forgot password: always returns success message (security, no account enumeration) (200).
		- Reset password: successful reset with valid token (200); rejects invalid token and validates short password (400).
	- **Password Change** (`POST /auth/change-password` - 2 tests):
		- Success: changes password with current password verification (200).
		- Rejects missing required fields (400).
	- **Users Management - GET** (`GET /users` - 3 tests):
		- Success: returns users list for admin's organization (200).
		- Rejects non-admin users (403).
		- Handles missing organization context (403).
	- **Users Management - POST** (`POST /users` - 4 tests):
		- Success: creates user with role='user' in admin's organization (201).
		- Rejects non-admin users (403).
		- Validates duplicate email and missing fields (400).
	- **Users Management - DELETE** (`DELETE /users/:id` - 2 tests):
		- Success: deletes user from organization (200).
		- Rejects non-admin users (403).
	- **Health Check** (`GET /health` - 1 test):
		- Returns service status and database connection state (200).
	- **Security & Edge Cases** (5 tests):
		- Validates invalid email format (400).
		- Validates missing required fields (400).
		- Ensures passwordHash not exposed in responses.
		- Tests RBAC enforcement across endpoints.
		- Tests organization data isolation.
	- Mocks: AuthService (business logic), RefreshToken model (database), User model (partial), logger, email sender.

Running Tests
- Command: `npm test` (runs all tests with verbose output)
- Uses Jest with ES Modules support (`cross-env NODE_OPTIONS=--experimental-vm-modules jest --verbose`)
- Tests run in isolated environment with mocked dependencies (no real MongoDB or email service connection required)
- All mocks are defined before importing application code using `jest.unstable_mockModule`
- Environment variables are set in test file (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`)

Test Coverage
- **Request Validation**: Tests verify proper HTTP status codes for invalid inputs (short password, missing required fields, invalid email format).
- **Security**: Tests ensure proper validation and rejection of duplicate credentials, invalid passwords, unauthorized token usage, and passwordHash exposure.
- **Authentication Flows**: Tests verify complete authentication flows including login, token generation, token refresh, logout, password reset, and password change.
- **Role-Based Access Control (RBAC)**: Tests validate admin-only endpoints (users management, reset-secret), role enforcement, and unauthorized access rejection (403).
- **Users Management**: Tests verify CRUD operations for users (GET/POST/DELETE), organization data isolation, role enforcement (admins cannot create other admins), self-deletion prevention.
- **JWT Token Handling**: Tests validate JWT token creation, cryptographic signing, database persistence of refresh tokens, and token revocation.
- **API Key Authentication**: Tests verify B2B authentication flow (validate-api-key), API secret hashing and comparison, and API secret reset.
- **Database Interaction**: Tests verify correct interaction with RefreshToken, User, and Organization models (save, find, delete operations).
- **Error Handling**: Tests ensure proper HTTP error codes for various failure scenarios (validation errors 400, authentication errors 401, forbidden access 403, not found 404, server errors 500).
- **Data Isolation**: Tests verify organization-scoped operations (admins can only manage users from their own organization).
- **Health Monitoring**: Tests verify health check endpoint returns service and database status.

Example Test Execution
```bash
npm test
```

Expected output:
```
PASS  tests/auth.test.js
  Auth Service Integration Tests
    POST /auth/register-organization
      ✓ should register organization (Happy Path) -> 201
      ✓ should fail on Duplicate -> 400
      ✓ should fail Validation (short password) -> 400
    POST /auth/register-user
      ✓ should register user with admin auth -> 201
      ✓ should reject non-admin registration -> 403
      ✓ should validate duplicate email -> 400
      ✓ should validate missing organizationId -> 404
      ✓ should validate required fields -> 400
    POST /auth/login
      ✓ should login (Success) -> 200 + tokens
      ✓ should fail login (Wrong Password) -> 401
    POST /auth/refresh
      ✓ should refresh token (Success) -> 200 + new AccessToken
      ✓ should fail (Reuse/Invalid/Logged Out) -> 403
    POST /auth/logout
      ✓ should logout (Remove token) -> 200
      ✓ should prevent refresh after logout (revoked token) -> 403
    POST /auth/internal/validate-api-key
      ✓ should validate correct API key -> 200
      ✓ should reject invalid API key -> 401
      ✓ should reject invalid secret -> 401
      ✓ should reject missing credentials -> 400
    POST /auth/reset-secret
      ✓ should reset secret (Admin) -> 200
      ✓ should reject non-admin -> 403
      ✓ should reject missing context -> 401
    POST /auth/forgot-password
      ✓ should send reset email -> 200
      ✓ should return success for non-existent email (security) -> 200
    POST /auth/reset-password
      ✓ should reset password with valid token -> 200
      ✓ should reject invalid token -> 400
      ✓ should validate short password -> 400
    POST /auth/change-password
      ✓ should change password -> 200
      ✓ should reject missing fields -> 400
    GET /users
      ✓ should return users list (Admin) -> 200
      ✓ should reject non-admin -> 403
      ✓ should validate missing org context -> 403
    POST /users
      ✓ should create user (Admin, role forced to user) -> 201
      ✓ should reject non-admin -> 403
      ✓ should validate duplicate email -> 400
      ✓ should validate required fields -> 400
    DELETE /users/:id
      ✓ should delete user (Admin) -> 200
      ✓ should reject non-admin -> 403
    GET /health
      ✓ should return health status -> 200
    Security & Edge Cases
      ✓ should validate invalid email format -> 400
      ✓ should validate missing required fields -> 400
      ✓ should not expose passwordHash in responses
      ✓ should enforce RBAC across endpoints
      ✓ should enforce organization data isolation

  Test Suites: 1 passed, 1 total
  Tests:       31 passed, 31 total
  Time:        1.553 s
```