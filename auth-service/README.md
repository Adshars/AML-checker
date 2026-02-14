Auth Service
============

Authentication and user management service for the AML Checker platform. Handles organization registration, user authentication with JWT tokens, API key management for B2B integrations, password reset flows, and role-based access control (RBAC). Stores data in MongoDB and provides structured logging with Winston.

**Version:** 1.0.0  
**Node.js:** 18+ (Alpine)  
**Type:** ES Modules

## Table of Contents

- [Stack and Dependencies](#stack-and-dependencies)
- [Environment and Configuration](#environment-and-configuration)
- [Local Setup](#local-setup)
- [Docker Compose Setup](#docker-compose-setup)
- [Endpoints](#endpoints)
- [Usage Examples](#usage-examples)
- [Response Structure](#response-structure)
- [Architecture](#architecture)
- [Data Models](#data-models)
- [How It Works](#how-it-works-high-level)
- [Testing](#testing)
- [License](#license)

---

## Stack and Dependencies

**Core Framework:**
- **Node.js 18+** (Alpine) – Lightweight production runtime
- **Express 5.2.1** – Fast, minimalist web framework with ES Modules support
- **Mongoose 9.0.1** – MongoDB ODM for data modeling and validation

**Authentication & Security:**
- **bcryptjs** 3.0.3 – Password and API secret hashing (salt rounds: 10)
- **jsonwebtoken** 9.0.3 – JWT token generation and verification
- **cookie-parser** 1.4.7 – Parse refresh token cookies
- **cors** 2.8.5 – Dependency present, CORS is handled by API Gateway (auth-service does not enable CORS)
- **express-rate-limit** 7.1.5 – IP-based rate limiting (50 req/15min for login)

**Validation & Communication:**
- **joi** 18.0.2 – Request payload validation (email format, password rules, required fields)
- **nodemailer** 7.0.12 – Email delivery for welcome messages and password reset

**Configuration & Logging:**
- **dotenv** 17.2.3 – Environment variable management
- **winston** 3.19.0 – Structured logging with multiple transports
- **winston-daily-rotate-file** 5.0.0 – Automatic log rotation (daily app/error logs)

**Development & Testing:**
- **jest** 30.2.0 – Test runner with ES Modules support
- **supertest** 7.2.2 – HTTP assertions for integration testing
- **cross-env** 10.1.0 – Cross-platform environment variables

## Environment and Configuration

**Required Variables:**
- `JWT_SECRET` – Secret key for JWT access token signing (default expiry: 15 minutes)
- `MONGO_URI` – MongoDB connection string (default: `mongodb://localhost:27017/auth_db`)
  - In docker-compose: built from `.env` variables (username, password, port, database)

**Optional Variables:**
- `REFRESH_TOKEN_SECRET` – Secret key for refresh token signing (defaults to `JWT_SECRET` if not set)
- `JWT_EXPIRES_IN` – Access token TTL (default: `15m`)
- `JWT_ACCESS_EXPIRATION` – Alternative access token TTL (takes precedence over `JWT_EXPIRES_IN` if set)
- `REFRESH_TOKEN_EXPIRES_IN` – Refresh token TTL (default: `7d`)
- `FRONTEND_URL` – Frontend URL for password reset links (default: `http://localhost:5173`)
- `SMTP_HOST` – SMTP host for email delivery (default: `smtp.ethereal.email`)
- `SMTP_PORT` – SMTP port (default: 587)
- `SMTP_SECURE` – Use TLS for SMTP (`true`/`false`)
- `SMTP_USER` – SMTP username
- `SMTP_PASS` – SMTP password
- `PORT` – Application port (default: 3000)

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables (create `.env` file or export):
   ```bash
   export MONGO_URI="mongodb://localhost:27017/auth_db"
   export JWT_SECRET="your-secret-key"
   export REFRESH_TOKEN_SECRET="your-refresh-secret"
   ```

3. Start the service:
   ```bash
   node src/index.js
   ```

4. Run tests:
   ```bash
   npm test
   ```

## Docker Compose Setup

From project root directory:
```bash
docker compose up --build auth-service
```

- Service is internal by default (no host port exposed). Uncomment the `ports` section in `docker-compose.yml` to expose it.
- MongoDB connection handled automatically via docker-compose network
- Logs available in `logs/` directory with daily rotation

## Endpoints

### Service Endpoints

| Method | Endpoint | Auth Required | Role Required | Description |
|--------|----------|---------------|---------------|-------------|
| GET | `/health` | ❌ No | - | Returns service status and MongoDB connection state (Connected/Disconnected) |

### Authentication Endpoints (`/auth/*`)

#### Public Endpoints (No Authentication Required)

| Method | Endpoint | Rate Limit | Description | Required Fields |
|--------|----------|------------|-------------|-----------------|
| POST | `/auth/login` | 50 req/15min | User login; returns access token (body) + refresh token (HttpOnly Cookie) | `email`, `password` |
| POST | `/auth/refresh` | None | Generate new access token using refresh token from Cookie (rotates cookie) | - (Cookie) |
| POST | `/auth/logout` | None | Revoke refresh token from database and clear Cookie | - (Cookie) |
| POST | `/auth/forgot-password` | None | Request password reset email (always returns success message) | `email` |
| POST | `/auth/reset-password` | None | Reset password using token from email | `userId`, `token`, `newPassword` |

#### Protected Endpoints (Gateway Context Required)

| Method | Endpoint | Auth Required | Role Required | Description | Required Fields |
|--------|----------|---------------|---------------|-------------|-----------------|
| POST | `/auth/register-organization` | ✅ Gateway headers | superadmin | Register new organization with admin user; generates API key/secret; sends welcome email to admin | `orgName`, `country`, `city`, `address`, `email`, `password`, `firstName`, `lastName` |
| POST | `/auth/register-user` | ✅ Gateway headers | admin/superadmin | Add user to organization (role forced to `user`); sends welcome email | `email`, `password`, `firstName`, `lastName`, `organizationId` |
| POST | `/auth/reset-secret` | ✅ Gateway headers | admin only | Reset organization's API secret; requires password confirmation | `password` |
| POST | `/auth/change-password` | ✅ Gateway headers | - | Change authenticated user's password | `currentPassword`, `newPassword` |
| GET | `/auth/organization/keys` | ✅ Gateway headers | - | Get organization's public API key | - |

#### Internal Endpoints (Not Exposed via Gateway)

| Method | Endpoint | Description | Required Fields |
|--------|----------|-------------|-----------------|
| POST | `/auth/internal/validate-api-key` | Validate API key/secret for API Gateway (B2B auth) | `apiKey`, `apiSecret` |

### Users Management Endpoints (`/users/*`)

All users management endpoints require **gateway-injected context headers** with **admin or superadmin role** and **organization context** (`x-org-id`, `x-user-id`, `x-role`).

| Method | Endpoint | Description | Required Fields | Security Features |
|--------|----------|-------------|-----------------|-------------------|
| GET | `/users` | List all regular users in organization | - | Returns `data` array; hides admins; organization data isolation |
| POST | `/users` | Create new user in organization; sends welcome email | `email`, `password`, `firstName`, `lastName` | **Role forced to `user`**; organizationId auto-assigned from admin context |
| DELETE | `/users/:id` | Delete user from organization | - | Prevents self-deletion; org isolation; only superadmins can delete admins |

### Endpoint Details

**Authentication & Authorization:**
- JWT tokens contain: `userId`, `organizationId`, `role`, `email`, `firstName`, `lastName`
- Access token validity: configurable via `JWT_EXPIRES_IN` / `JWT_ACCESS_EXPIRATION`
- Refresh token validity: configurable via `REFRESH_TOKEN_EXPIRES_IN`
- Rate limiting: 50 req/15min for login endpoint (express-rate-limit)

**Validation Rules (Joi):**
- Email: valid format with `@` and domain
- Password: minimum 8 characters
- All required fields validated before processing

**Error Responses:**
- 400: Validation errors, duplicate entries, missing fields
- 401: Invalid credentials, missing refresh token cookie
- 403: Insufficient permissions, invalid/revoked refresh token
- 404: Resource not found (user, organization, token)
- 500: Server errors

**Security Features:**
- Passwords hashed with bcryptjs (salt rounds: 10)
- API secrets hashed with bcryptjs (never stored in plaintext)
- Refresh tokens stored in DB with rotation on refresh
- Organization-based data isolation
- Role-based access control (RBAC) enforced via gateway-injected headers
- Self-deletion prevention
- Admin role elevation prevention (forced user role in POST /users)

## Usage Examples

### Health Check

**Request:**
```bash
curl http://localhost:3000/health
```
**Response (200 OK):**
```json
{
  "service": "auth-service",
  "status": "UP",
  "database": "Connected"
}
```

### 1. Register Organization (Superadmin Only)

**Request:**
```bash
curl -X POST http://localhost:3000/auth/register-organization \
  -H "Content-Type: application/json" \
  -H "x-role: superadmin" \
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

**Response (201 Created):**
```json
{
  "message": "Organization registered successfully",
  "organization": {
    "id": "64a8b9c7d2f3e4a1b2c3d4e5",
    "name": "ACME Corp",
    "location": "Warsaw, PL",
    "apiKey": "pk_live_abc123xyz789",
    "apiSecret": "sk_live_def456uvw012"
  },
  "user": {
    "id": "64a8b9c7d2f3e4a1b2c3d4e6",
    "fullName": "John Smith",
    "email": "admin@acme.test",
    "role": "admin"
  }
}
```

Note: Sends welcome email to admin. API secret shown only once.

### 2. Login

**Request:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.test",
    "password": "Str0ngPass!"
  }'
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64a8b9c7d2f3e4a1b2c3d4e6",
    "email": "admin@acme.test",
    "role": "admin",
    "firstName": "John",
    "lastName": "Smith",
    "organizationId": "64a8b9c7d2f3e4a1b2c3d4e5"
  }
}
```

Note: Access token (body) expires per `JWT_EXPIRES_IN`. Refresh token (HttpOnly Cookie) expires per `REFRESH_TOKEN_EXPIRES_IN`.

### 3. Register User (Admin/Superadmin Only)

**Request:**
```bash
curl -X POST http://localhost:3000/auth/register-user \
  -H "Content-Type: application/json" \
  -H "x-role: admin" \
  -d '{
    "email": "user@acme.test",
    "password": "Str0ngPass!",
    "firstName": "Jane",
    "lastName": "Doe",
    "organizationId": "64a8b9c7d2f3e4a1b2c3d4e5"
  }'
```

**Response (201 Created):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "64a8b9c7d2f3e4a1b2c3d4e7",
    "fullName": "Jane Doe",
    "email": "user@acme.test",
    "role": "user",
    "organizationId": "64a8b9c7d2f3e4a1b2c3d4e5"
  }
}
```

Note: Sends welcome email to new user. Role is forced to `user` regardless of input.

### 4. Refresh Access Token

**Request:**
```bash
curl -X POST http://localhost:3000/auth/refresh \
  --cookie "refreshToken=<REFRESH_TOKEN_COOKIE>"
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 5. Logout (Revoke Refresh Token)

**Request:**
```bash
curl -X POST http://localhost:3000/auth/logout \
  --cookie "refreshToken=<REFRESH_TOKEN_COOKIE>"
```

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

### 6. Request Password Reset

**Request:**
```bash
curl -X POST http://localhost:3000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.test"
  }'
```

**Response (200 OK):**
```json
{
  "message": "If a user with that email exists, a password reset link has been sent."
}
```

Note: Password reset token valid for 1 hour.

### 7. Reset Password

**Request:**
```bash
curl -X POST http://localhost:3000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<USER_ID>",
    "token": "<TOKEN_FROM_EMAIL>",
    "newPassword": "NewStr0ngPass!"
  }'
```

**Response (200 OK):**
```json
{
  "message": "Password has been reset successfully"
}
```

### 8. Change Password (Authenticated)

**Request:**
```bash
curl -X POST http://localhost:3000/auth/change-password \
  -H "x-user-id: <USER_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPassword123",
    "newPassword": "NewStr0ngPass!"
  }'
```

**Response (200 OK):**
```json
{
  "message": "Password updated successfully"
}
```

### 9. Reset Organization API Secret (Admin Only)

**Request:**
```bash
curl -X POST http://localhost:3000/auth/reset-secret \
  -H "x-role: admin" \
  -H "x-org-id: <ORG_ID>" \
  -H "x-user-id: <USER_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "YourCurrentPassword123"
  }'
```

**Response (200 OK):**
```json
{
  "message": "API secret reset successfully",
  "apiKey": "pk_live_abc123xyz789",
  "newApiSecret": "sk_live_newSecret789xyz"
}
```

Warning: API secret shown only once. Store securely.

### 10. Get Organization API Key

**Request:**
```bash
curl -X GET http://localhost:3000/auth/organization/keys \
  -H "x-org-id: <ORG_ID>" \
  -H "x-user-id: <USER_ID>"
```

**Response (200 OK):**
```json
{
  "apiKey": "pk_live_abc123xyz789"
}
```

### 11. Get All Users in Organization (Admin Only)

**Request:**
```bash
curl -X GET http://localhost:3000/users \
  -H "x-role: admin" \
  -H "x-org-id: <ORG_ID>" \
  -H "x-user-id: <USER_ID>"
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "64a8b9c7d2f3e4a1b2c3d4e7",
      "email": "user1@acme.test",
      "firstName": "Jane",
      "lastName": "Doe",
      "role": "user",
      "createdAt": "2024-01-01T10:00:00.000Z"
    },
    {
      "id": "64a8b9c7d2f3e4a1b2c3d4e8",
      "email": "user2@acme.test",
      "firstName": "Bob",
      "lastName": "Smith",
      "role": "user",
      "createdAt": "2024-01-02T10:00:00.000Z"
    }
  ]
}
```

### 12. Create User in Organization (Admin Only)

**Request:**
```bash
curl -X POST http://localhost:3000/users \
  -H "x-role: admin" \
  -H "x-org-id: <ORG_ID>" \
  -H "x-user-id: <USER_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@acme.test",
    "password": "Str0ngPass!",
    "firstName": "Alice",
    "lastName": "Johnson"
  }'
```

**Response (201 Created):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "64a8b9c7d2f3e4a1b2c3d4e9",
    "email": "newuser@acme.test",
    "firstName": "Alice",
    "lastName": "Johnson",
    "role": "user",
    "organizationId": "64a8b9c7d2f3e4a1b2c3d4e5",
    "createdAt": "2024-01-03T10:00:00.000Z"
  }
}
```

Note: Role is forced to `user`. Sends welcome email.

### 13. Delete User (Admin Only)

**Request:**
```bash
curl -X DELETE http://localhost:3000/users/<USER_ID> \
  -H "x-role: admin" \
  -H "x-org-id: <ORG_ID>" \
  -H "x-user-id: <USER_ID>"
```

**Response (200 OK):**
```json
{
  "message": "User deleted successfully"
}
```

Warning: Self-deletion prevented. User must belong to admin's organization.

---

## Response Structure

**Health Check:**
```json
{
  "service": "auth-service",
  "status": "UP",
  "database": "Connected"
}
```

**Organization Registration:**
```json
{
  "message": "Organization registered successfully",
  "organization": {
    "id": "<org_id>",
    "name": "ACME Corp",
    "location": "Warsaw, PL",
    "apiKey": "pk_live_...",
    "apiSecret": "sk_live_..."
  },
  "user": {
    "id": "<user_id>",
    "fullName": "John Smith",
    "email": "admin@acme.test",
    "role": "admin"
  }
}
```

**Login Response:**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64a8b9c7d2f3e4a1b2c3d4e6",
    "email": "admin@acme.test",
    "role": "admin",
    "firstName": "John",
    "lastName": "Smith",
    "organizationId": "64a8b9c7d2f3e4a1b2c3d4e5"
  }
}
```

**API Key Validation (Internal):**
```json
{
  "valid": true,
  "organizationId": "64a8b9c7d2f3e4a1b2c3d4e5",
  "organizationName": "ACME Corp"
}
```

**Error Responses:**
```json
{
  "error": "Email already in use",
  "details": "A user with this email address already exists"
}
```

```json
{
  "error": "Invalid credentials",
  "details": "Incorrect email or password"
}
```

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

---

## Architecture

**Design Pattern:**
- Layered architecture: API controllers, application services, repositories, domain entities
- Authentication relies on gateway-injected headers (no JWT validation in auth-service)

**Key Components:**
- **Controllers** ([src/api/controllers/](src/api/controllers/))
  - [AuthController.js](src/api/controllers/AuthController.js) – Login, refresh, logout, API key validation
  - [OrganizationController.js](src/api/controllers/OrganizationController.js) – Organization registration, API key management
  - [PasswordController.js](src/api/controllers/PasswordController.js) – Forgot/reset/change password flows
  - [UserController.js](src/api/controllers/UserController.js) – User CRUD operations (admin only)

- **Services** ([src/application/services/](src/application/services/))
  - [AuthenticationService.js](src/application/services/AuthenticationService.js) – Login, token refresh/logout, API key validation
  - [OrganizationService.js](src/application/services/OrganizationService.js) – Organization registration, secret reset, keys
  - [UserService.js](src/application/services/UserService.js) – User registration and management
  - [PasswordService.js](src/application/services/PasswordService.js) – Password reset and change
  - [TokenService.js](src/application/services/TokenService.js) – Access/refresh token generation and storage

- **Domain Entities** ([src/domain/entities/](src/domain/entities/))
  - [Organization.js](src/domain/entities/Organization.js) – Organization data with API credentials
  - [User.js](src/domain/entities/User.js) – User accounts with roles and organization association

- **Repositories** ([src/infrastructure/database/mongoose/repositories/](src/infrastructure/database/mongoose/repositories/))
  - MongoDB repositories for users, organizations, refresh tokens, password reset tokens

- **Routes** ([src/api/routes/](src/api/routes/))
  - [authRoutes.js](src/api/routes/authRoutes.js) – Login, refresh, logout, API key validation
  - [organizationRoutes.js](src/api/routes/organizationRoutes.js) – Register organization, reset secret, get keys
  - [passwordRoutes.js](src/api/routes/passwordRoutes.js) – Forgot/reset/change password
  - [userRoutes.js](src/api/routes/userRoutes.js) – User management and /auth/register-user

- **Shared** ([src/shared/](src/shared/))
  - [config/index.js](src/shared/config/index.js) – Environment configuration
  - [logger/index.js](src/shared/logger/index.js) – Winston logger with daily rotation
  - [errors/](src/shared/errors/) – Error types and codes

**Logging Infrastructure:**
- Winston logger with structured format
- Daily rotating file transports (logs/%DATE%-app.log, logs/%DATE%-error.log)
- Console transport with colorized output

## Data Models

**Organization**
```javascript
{
  name: String (unique, required),
  country: String (required),
  city: String (required),
  address: String (required),
  apiKey: String (unique, format: "pk_live_..."),
  apiSecretHash: String (bcrypt hashed),
  createdAt: Date (auto-generated)
}
```

**User**
```javascript
{
  email: String (unique, lowercase, required),
  passwordHash: String (bcrypt hashed, required),
  firstName: String (required),
  lastName: String (required),
  organizationId: ObjectId (references Organization),
  role: String (enum: ['superadmin', 'admin', 'user'], default: 'user'),
  createdAt: Date (auto-generated)
}
```

**RefreshToken**
```javascript
{
  token: String (JWT, required),
  userId: ObjectId (references User),
  createdAt: Date (TTL index: expires after 7 days)
}
```

**PasswordResetToken**
```javascript
{
  userId: ObjectId (references User),
  token: String (random, required),
  createdAt: Date (TTL index: expires after 1 hour)
}
```

## How It Works (High Level)

**Organization Registration:**
1. Validates required fields (orgName, email, password, firstName, lastName, country, city, address)
2. Checks for duplicate organization name and email
3. Generates API credentials: `apiKey` and `apiSecret`
4. Creates Organization document with hashed API secret
5. Creates admin User with hashed password
6. Sends welcome email (non-blocking)
7. Returns plaintext `apiSecret` (visible only once)

**User Registration:**
1. Validates required fields and checks organizationId existence
2. Verifies email uniqueness
3. Hashes password with bcryptjs
4. Creates User with role `user` and organization association
5. Sends welcome email (non-blocking)
6. Returns created user details

**Login Flow:**
1. Finds user by email
2. Compares password against hash using bcryptjs
3. Generates access token signed with `JWT_SECRET`
4. Generates refresh token signed with `REFRESH_TOKEN_SECRET`
5. Stores refresh token in database
6. Returns access token in body and refresh token as HttpOnly cookie
7. Rate limited to 50 requests per 15 minutes per IP

**Token Refresh:**
1. Validates refresh token exists in database (not revoked)
2. Verifies token signature
3. Revokes old refresh token and issues a new one (rotation)
4. Returns new access token and sets rotated refresh cookie

**Logout:**
1. Deletes refresh token from database
2. Clears refresh token cookie

**Password Reset Flow:**
1. Forgot password: generates token, sends email, always returns success message
2. Reset password: validates token, hashes new password, deletes used token

**Change Password:**
1. Requires `x-user-id` header from API Gateway
2. Verifies current password and updates password hash

**Reset API Secret:**
1. Requires `admin` role and `x-org-id` / `x-user-id` headers
2. Verifies password, generates new secret, returns plaintext once

**Get Organization Keys:**
1. Requires `x-org-id` and `x-user-id` headers
2. Returns public `apiKey`

**API Key Validation (Internal):**
1. Finds organization by apiKey
2. Compares apiSecret against stored hash
3. Returns organization ID and name on success

**Users Management:**
- GET `/users`: returns `data` array of users for organization (excludes admins)
- POST `/users`: creates user with forced `user` role and admin's organizationId
- DELETE `/users/:id`: prevents self-deletion; superadmin can delete admins

## Testing

The Auth Service includes integration tests that verify endpoint behavior, validation, authentication flows, role-based access control, and interaction with external dependencies.

**Test Framework:**
- **jest** 30.2.0 – Test runner with ES Modules support
- **supertest** 7.2.2 – HTTP assertions
- **Mocking**: Jest mocks for Mongoose schemas, nodemailer, and logger

**Test File:** [tests/auth.test.js](tests/auth.test.js)

**Running Tests:**
```bash
npm test
```

**Notes:**
- Tests run with mocked dependencies (no real MongoDB or email service).
- Environment variables are set in the test file (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`).

---

## License

MIT
