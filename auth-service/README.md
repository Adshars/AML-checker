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
- `POST /auth/register-organization` – registers organization and admin user, generates `apiKey` and returns `apiSecret` once.
	- Required fields: `orgName`, `country`, `city`, `address`, `email`, `password`, `firstName`, `lastName`.
	- Validations: duplicate org name, duplicate email; 400 errors. Server error 500.
- `POST /auth/register-user` – adds user to existing organization.
	- Required fields: `email`, `password`, `firstName`, `lastName`, `organizationId`.
	- Validations: organizationId existence, duplicate email; 400/404 errors; server error 500.
- `POST /auth/login` – authenticates user and returns JWT token.
	- Required fields: `email`, `password`.
	- Validations: user existence, password match; 401 errors. Server error 500.
	- Returns JWT token valid for 8 hours with user data.

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

How It Works (High Level)
- `register-organization`: checks for duplicates, generates apiKey/apiSecret, hashes secret and password, saves Organization and User (admin); secret returned only once.
- `register-user`: validates organizationId, checks email, hashes password, sets role to `user` and saves record.
- `login`: validates credentials, compares password hash, generates JWT token with userId, organizationId and role; token valid for 8 hours.
- `/health`: reports service status and Mongoose connection state.

Limitations and TODO
- No authorization middleware for protected routes.
- No rate limiting or schema validation (Joi/Zod).
- No API key rotation, password reset, or operation auditing.
