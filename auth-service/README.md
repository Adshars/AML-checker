Auth-Service
============

Authentication and registration service for organizations and users in the AML Checker platform. Generates API keys (apiKey, apiSecret) for organizations, stores data in MongoDB, and provides health-check endpoint.

Stack and Dependencies
- Node.js 18, Express 5, ES Modules
- Mongoose 9 + MongoDB 6
- bcryptjs (password and apiSecret hashing), jsonwebtoken (JWT authentication), cors, dotenv

Environment and Configuration
- `MONGO_URI` – MongoDB connection string; defaults to `mongodb://localhost:27017/auth_db` in code.
- In docker-compose, MONGO_URI is built from `.env` variables (username, password, port, database).
- `JWT_SECRET` – secret key for JWT token signing (required for login functionality).
- Application port in container: 3000; mapped via `PORT_AUTH` variable (default 3002).

Local Setup
1) `npm install`
2) `node src/index.js` (optionally set `MONGO_URI` and `JWT_SECRET` environment variables)

Docker Compose Setup
- From project root directory: `docker compose up --build auth-service`
- Endpoints will be available at http://localhost:3002 (PORT_AUTH:3000 mapping).

Endpoints
- `GET /health` – returns service status and MongoDB connection (`{ service, status, database }`).
- `POST /auth/register-organization` – registers organization and admin user, generates `apiKey` and returns `apiSecret` once (never stored in plain text).
	- Required fields: `orgName`, `country`, `city`, `address`, `email`, `password`, `firstName`, `lastName`.
	- Validations: duplicate org name, duplicate email; 400 errors. Server error 500.
	- Returns: organization details with `apiKey` (format: `pk_live_...`) and `apiSecret` (format: `sk_live_...`) visible only once; admin user with role `admin`.
- `POST /auth/register-user` – adds user to existing organization with `user` role.
	- Required fields: `email`, `password`, `firstName`, `lastName`, `organizationId`.
	- Validations: organizationId existence, duplicate email; 400/404 errors; server error 500.
	- Returns: user details (email, name, role, organization assignment).
- `POST /auth/login` – authenticates user by email/password and returns JWT token.
	- Required fields: `email`, `password`.
	- Validations: user existence, password match; 401 errors. Server error 500.
	- Returns JWT token valid for 8 hours; token payload includes `userId`, `organizationId`, `role`.
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
	"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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
- `login`: finds user by email, compares provided password against stored hash using bcryptjs, generates JWT token with payload `{ userId, organizationId, role }` signed with `JWT_SECRET` and expiring in 8 hours; returns token and user info.
- `/auth/internal/validate-api-key`: finds organization by apiKey, compares provided plaintext apiSecret against stored hash using bcryptjs, returns organization ID and name on success (used by API Gateway for B2B authentication).
- `/health`: reports service status and Mongoose connection state (1 = Connected, other = Disconnected).

Authentication Methods
- **User Login (JWT)**: User provides email and password → receives JWT token valid 8 hours → uses token in `Authorization: Bearer <token>` header for API calls → API Gateway verifies token signature.
- **System/B2B (API Key)**: Organization receives `apiKey` and `apiSecret` at registration → uses both in `x-api-key` and `x-api-secret` headers → API Gateway validates credentials with this internal endpoint.

Data Models
- **Organization**: { name (unique), country, city, address, apiKey (unique), apiSecretHash, createdAt }
- **User**: { email (unique, lowercase), passwordHash, firstName, lastName, organizationId (references Organization), role (admin|user), createdAt }

Limitations and TODO
- No authorization middleware on routes; all endpoints accessible without role checks (recommend adding middleware for admin-only operations).
- No rate limiting or request throttling on registration/login endpoints (vulnerable to brute force and account enumeration attacks).
- No schema validation using Joi/Zod; relies only on basic field presence checks.
- No API key rotation endpoint; keys are permanent after generation (consider adding key versioning/rotation).
- No password reset flow; users cannot self-service reset forgotten passwords.
- No operation auditing; no logging of authentication events, failed attempts, or API key usage.
- No token revocation/blacklist; logged-out tokens remain valid until expiration.
- Secret is returned in plaintext only once; if user loses it during registration, recovery requires admin intervention or re-registration.
