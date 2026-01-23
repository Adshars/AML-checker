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
- `GET /health` – returns service status and MongoDB connection (`{ service, status, database }`).
- `POST /auth/register-organization` – registers organization and admin user, generates `apiKey` and returns `apiSecret` once (never stored in plain text).
	- Required fields: `orgName`, `country`, `city`, `address`, `email`, `password`, `firstName`, `lastName`.
	- Validations: required fields (Joi), email format, password minimum 8 characters; duplicate org name, duplicate email; 400 errors. Server error 500.
	- Returns: organization details with `apiKey` (format: `pk_live_...`) and `apiSecret` (format: `sk_live_...`) visible only once; admin user with role `admin`.
- `POST /auth/register-user` – adds user to existing organization with `user` role.
	- Required fields: `email`, `password`, `firstName`, `lastName`, `organizationId`.
	- Validations: required fields (Joi), email format, password minimum 8 characters; organizationId existence, duplicate email; 400/404 errors; server error 500.
	- Returns: user details (email, name, role, organization assignment).
- `POST /auth/login` – authenticates user by email/password and returns access token + refresh token.
	- Required fields: `email`, `password`.
	- Rate limited: 10 requests per 15 minutes per IP (express-rate-limit in `authRoutes`).
	- Validations: email format (Joi), password required; user existence, password match; 401 errors. Server error 500.
	- Returns: `accessToken` valid for 15 minutes (JWT payload includes `userId`, `organizationId`, `role`); `refreshToken` valid for 7 days.
- `POST /auth/refresh` – generates new access token using valid refresh token.
	- Required fields: `refreshToken` (from login response).
	- Validations: token exists in DB (not revoked), cryptographic verification; 401/403 errors.
	- Returns: new `accessToken` valid for 15 minutes.
- `POST /auth/logout` – revokes refresh token (user cannot refresh access token after logout).
	- Required fields: `refreshToken`.
	- Deletes refresh token from database.
	- Returns: logout success message.
- `POST /auth/forgot-password` – requests password reset email (public endpoint, no auth required).
	- Required fields: `email`.
	- Always returns success message for security (no account enumeration).
	- Sends email with reset link containing token and user ID (valid for 1 hour).
- `POST /auth/reset-password` – resets password using token from email.
	- Required fields: `userId`, `token`, `newPassword`.
	- Validations: token existence and validity; new password minimum 8 characters (Joi); 400 errors. Server error 500.
	- Hashes new password and updates user record; deletes used reset token.
	- Returns: reset success message.
- `POST /auth/reset-secret` – resets organization's API secret (admin only, requires authentication).
	- Requires: valid JWT token with `admin` or `superadmin` role (via `x-role` header from API Gateway).
	- Validations: authentication context, admin role check; 401/403 errors. Server error 500.
	- Returns: organization `apiKey` and new `apiSecret` (plaintext, visible only once).
- `POST /auth/internal/validate-api-key` – internal endpoint for API Gateway; validates API key and secret (B2B machine-to-machine authentication).
	- Required fields: `apiKey`, `apiSecret`.
	- Validations: API key existence, secret match (bcrypt comparison); 401 errors. Server error 500.
	- Returns: `{ valid: true, organizationId, organizationName }` on success.

Usage Examples
- Health check:
```bash
curl http://localhost:3002/health
```

- Organization + admin registration:
```bash
curl -X POST http://localhost:3002/auth/register-organization \
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

- User registration (requires existing `organizationId`):
```bash
curl -X POST http://localhost:3002/auth/register-user \
	-H "Content-Type: application/json" \
	-d '{
		"email": "user@acme.test",
		"password": "Str0ngPass!",
		"firstName": "Jane",
		"lastName": "Doe",
		"organizationId": "<ORG_ID>"
	}'
```

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

- Reset organization API secret (admin only, requires JWT auth via gateway):
```bash
curl -X POST http://localhost:8080/auth/reset-secret \
	-H "Authorization: Bearer <JWT_TOKEN>" \
	-H "Content-Type: application/json"
```
Returns new `apiSecret` (plaintext, visible only once).

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
- `register-organization`: validates required fields, checks for duplicate org name and email, generates `apiKey` (format: `pk_live_<random>`) and `apiSecret` (format: `sk_live_<random>`), hashes apiSecret and password using bcryptjs (salt 10), saves Organization with hashed secret, creates admin User associated with organization, returns organization and user details with **plaintext apiSecret visible only once**.
- `register-user`: validates required fields and checks organizationId existence, verifies email uniqueness, hashes password using bcryptjs (salt 10), saves User with role `user` and association to organization.
- `login`: finds user by email, compares password against hash using bcryptjs, generates `accessToken` (15 min, payload `{ userId, organizationId, role }`) signed with `JWT_SECRET`, generates `refreshToken` (7 days) signed with `REFRESH_TOKEN_SECRET`, stores refreshToken in DB, returns both tokens and user info. **Rate limited to 10 requests per 15 minutes per IP.**
- `refresh`: validates refreshToken exists in DB (not revoked) and passes cryptographic verification, fetches user (for current role), generates new `accessToken` (15 min).
- `logout`: deletes refreshToken from database; user cannot refresh access token after this call.
- `forgot-password`: finds user by email, generates random reset token, stores token in DB (expires 1 hour), sends email with reset link including token and userId. **Always returns success message to prevent account enumeration.**
- `reset-password`: finds PasswordResetToken by userId, verifies token matches, hashes new password using bcryptjs (salt 10), updates User passwordHash, deletes used token from DB.
- `reset-secret`: requires `admin` or `superadmin` role (via `x-role` header from API Gateway), generates new `apiSecret`, hashes and stores it, returns new credentials plaintext.
- `/auth/internal/validate-api-key`: finds organization by apiKey, compares provided plaintext apiSecret against stored hash using bcryptjs, returns organization ID and name on success (used by API Gateway for B2B authentication).
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
- **Organization**: { name (unique), country, city, address, apiKey (unique), apiSecretHash, createdAt }
- **User**: { email (unique, lowercase), passwordHash, firstName, lastName, organizationId (references Organization), role (superadmin|admin|user), createdAt }
- **PasswordResetToken**: { userId, token, createdAt (expires after 1 hour) }
- **RefreshToken**: { token, userId, createdAt (expires after 7 days) }

Implemented Features
- ✅ **Rate Limiting**: `/login` endpoint limited to 10 requests per 15 minutes per IP (express-rate-limit).
- ✅ **Password Reset Flow**: `forgot-password` (send email) and `reset-password` (token-based reset) with 1-hour token expiration.
- ✅ **Token Refresh/Revocation**: `refresh` endpoint for new access tokens; `logout` endpoint revokes refresh tokens from database.
- ✅ **Role-Based Access**: `superadmin`, `admin`, and `user` roles supported; `/reset-secret` requires `admin` or `superadmin` role.
- ✅ **Structured Logging**: winston with daily rotation for all authentication events and errors.
- ✅ **API Secret Reset**: `/reset-secret` endpoint allows admins to regenerate organization API credentials.
- ✅ **Schema Validation (Joi)**: email format and password minimum length enforced for registration, login, and reset-password.

Testing
-------

Integration tests for Auth Service verify endpoint behavior, request validation, authentication flows, and interaction with external dependencies (MongoDB, email service). Tests use Jest test framework with Supertest for HTTP testing and mock external dependencies.

Test Files
- `tests/auth.test.js` – comprehensive integration tests for all authentication endpoints.
	- **Organization Registration** (`POST /auth/register-organization`):
		- Happy path: successful organization and admin user registration with API key generation (201).
		- Duplicate email validation: rejects duplicate email registrations (400).
		- Password validation: enforces minimum 8-character password requirement via Joi (400).
	- **User Login** (`POST /auth/login`):
		- Success: authenticates user and returns JWT access token and refresh token (200).
		- Failure: rejects invalid credentials with 401 error.
	- **Token Refresh** (`POST /auth/refresh`):
		- Success: generates new access token using valid refresh token stored in database (200).
		- Failure: rejects invalid, expired, or revoked refresh tokens with 403 error.
	- **User Logout** (`POST /auth/logout`):
		- Success: revokes refresh token from database, preventing future token refreshes (200).
		- Rejects refresh attempts with revoked token (403 after logout).
	- Mocks: AuthService (business logic), RefreshToken model (database), User model, logger, email sender.

Running Tests
- Command: `npm test` (runs all tests with verbose output)
- Uses Jest with ES Modules support (`cross-env NODE_OPTIONS=--experimental-vm-modules jest --verbose`)
- Tests run in isolated environment with mocked dependencies (no real MongoDB or email service connection required)
- All mocks are defined before importing application code using `jest.unstable_mockModule`
- Environment variables are set in test file (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`)

Test Coverage
- **Request Validation**: Tests verify proper HTTP status codes for invalid inputs (short password, missing required fields).
- **Security**: Tests ensure proper validation and rejection of duplicate credentials, invalid passwords, and unauthorized token usage.
- **Authentication Flows**: Tests verify complete authentication flows including login, token generation, token refresh, and logout.
- **JWT Token Handling**: Tests validate JWT token creation, cryptographic signing, and database persistence of refresh tokens.
- **Database Interaction**: Tests verify correct interaction with RefreshToken and User models (save, find, delete operations).
- **Error Handling**: Tests ensure proper HTTP error codes for various failure scenarios (validation errors 400, authentication errors 401, unauthorized errors 403).

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
    POST /auth/login
      ✓ should login (Success) -> 200 + tokens
      ✓ should fail login (Wrong Password) -> 401
    POST /auth/refresh
      ✓ should refresh token (Success) -> 200 + new AccessToken
      ✓ should fail (Reuse/Invalid/Logged Out) -> 403
    POST /auth/logout
      ✓ should logout (Remove token) -> 200
		✓ should prevent refresh after logout (revoked token) -> 403

	Test Suites: 1 passed, 1 total
	Tests:       9 passed, 9 total
```