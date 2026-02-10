Auth Service
============

Authentication and user management service for the AML Checker platform. Handles organization registration, user authentication with JWT tokens, API key management for B2B integrations, password reset flows, and role-based access control (RBAC). Stores data in MongoDB and provides comprehensive logging with Winston.

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
  - [Health Check](#health-check)
  - [1. Register Organization (Superadmin Only)](#1-register-organization-superadmin-only)
  - [2. Login](#2-login)
  - [3. Register User (Admin/Superadmin Only)](#3-register-user-adminsuperadmin-only)
  - [4. Refresh Access Token](#4-refresh-access-token)
  - [5. Logout (Revoke Refresh Token)](#5-logout-revoke-refresh-token)
  - [6. Request Password Reset](#6-request-password-reset)
  - [7. Reset Password](#7-reset-password)
  - [8. Change Password (Authenticated)](#8-change-password-authenticated)
  - [9. Reset Organization API Secret (Admin Only)](#9-reset-organization-api-secret-admin-only)
  - [10. Get Organization API Key](#10-get-organization-api-key)
  - [11. Get All Users in Organization (Admin Only)](#11-get-all-users-in-organization-admin-only)
  - [12. Create User in Organization (Admin Only)](#12-create-user-in-organization-admin-only)
  - [13. Delete User (Admin Only)](#13-delete-user-admin-only)
- [Response Structure](#response-structure)
- [Architecture](#architecture)
  - [Design Pattern](#design-pattern)
  - [Key Components](#key-components)
  - [Security Features](#security-features)
  - [Logging Infrastructure](#logging-infrastructure)
- [Data Models](#data-models)
- [How It Works](#how-it-works-high-level)
  - [Organization Registration](#organization-registration)
  - [User Registration](#user-registration)
  - [Login Flow](#login-flow)
  - [Token Refresh & Logout](#token-refresh--logout)
  - [Password Reset Flow](#password-reset-flow)
  - [Authentication Methods](#authentication-methods)
  - [Implemented Features](#implemented-features)
- [Testing](#testing)
  - [Test Files](#test-files)
  - [Test Suites](#test-suites)
  - [Running Tests](#running-tests)
  - [Test Coverage](#test-coverage)
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
- **cors** 2.8.5 – Cross-Origin Resource Sharing configuration
- **express-rate-limit** 7.1.5 – IP-based rate limiting (50 req/15min for login)

**Validation & Communication:**
- **joi** 18.0.2 – Request payload validation (email format, password rules, required fields)
- **nodemailer** 7.0.12 – Email delivery for welcome messages and password reset

**Configuration & Logging:**
- **dotenv** 17.2.3 – Environment variable management
- **winston** 3.19.0 – Structured logging with multiple transports
- **winston-daily-rotate-file** 5.0.0 – Automatic log rotation (daily, error/combined logs)

**Development & Testing:**
- **jest** 30.2.0 – Test runner with ES Modules support
- **supertest** 7.2.2 – HTTP assertions for integration testing
- **cross-env** 10.1.0 – Cross-platform environment variables

## Environment and Configuration

**Required Variables:**
- `JWT_SECRET` – Secret key for JWT access token signing (15 min tokens)
- `REFRESH_TOKEN_SECRET` – Secret key for refresh token signing (7 day tokens)
- `MONGO_URI` – MongoDB connection string (default: `mongodb://localhost:27017/auth_db`)
  - In docker-compose: built from `.env` variables (username, password, port, database)

**Optional Variables:**
- `FRONTEND_URL` – Frontend URL for password reset links (default: `http://localhost:3000`)
- `EMAIL_HOST` – SMTP host for email delivery (default: `smtp.ethereal.email`)
- `EMAIL_PORT` – SMTP port (default: 587)
- `EMAIL_USER` – SMTP username
- `EMAIL_PASS` – SMTP password
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

- Service will be available at **http://localhost:3002** (port mapping from docker-compose)
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
| POST | `/auth/login` | 50 req/15min | User login; returns JWT access token (body) + refresh token (HttpOnly Cookie) | `email`, `password` |
| POST | `/auth/refresh` | None | Generate new access token using valid refresh token from Cookie | - (Cookie) |
| POST | `/auth/logout` | None | Revoke refresh token from database and clear Cookie | - (Cookie) |
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

## Usage Examples

### Health Check

**Request:**
```bash
curl http://localhost:3002/health
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
curl -X POST http://localhost:3002/auth/register-organization \
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
  "success": true,
  "message": "Organization and admin user registered successfully",
  "organization": {
    "_id": "64a8b9c7d2f3e4a1b2c3d4e5",
    "name": "ACME Corp",
    "city": "Warsaw",
    "country": "PL",
    "apiKey": "pk_live_abc123xyz789"
  },
  "user": {
    "_id": "64a8b9c7d2f3e4a1b2c3d4e6",
    "email": "admin@acme.test",
    "role": "admin",
    "firstName": "John",
    "lastName": "Smith"
  },
  "apiSecret": "sk_live_def456uvw012"
}
```

ℹ️ **Note:** Sends welcome email to admin with login instructions. API secret shown only once.

### 2. Login

**Request:**
```bash
curl -X POST http://localhost:3002/auth/login \
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

ℹ️ **Note:** Access token (body) expires in 15 minutes. Refresh token (HttpOnly Cookie) expires in 7 days.

### 3. Register User (Admin/Superadmin Only)

**Request:**
```bash
curl -X POST http://localhost:3002/auth/register-user \
  -H \"Content-Type: application/json\" \
  -H \"x-role: admin\" \
  -H \"x-org-id: 64a8b9c7d2f3e4a1b2c3d4e5\" \
  -d '{
    \"email\": \"user@acme.test\",
    \"password\": \"Str0ngPass!\",
    \"firstName\": \"Jane\",
    \"lastName\": \"Doe\",
    \"role\": \"user\"
  }'
```

**Response (201 Created):**
```json
{
  \"success\": true,
  \"message\": \"User registered successfully\",
  \"user\": {
    \"_id\": \"64a8b9c7d2f3e4a1b2c3d4e7\",
    \"email\": \"user@acme.test\",
    \"role\": \"user\",
    \"firstName\": \"Jane\",
    \"lastName\": \"Doe\",
    \"organizationId\": \"64a8b9c7d2f3e4a1b2c3d4e5\"
  }
}
```

ℹ️ **Note:** Sends welcome email to new user. Role is forced to 'user' regardless of input.

### 4. Refresh Access Token

**Request:**
```bash
curl -X POST http://localhost:3002/auth/refresh \
  -H "Content-Type: application/json" \
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
curl -X POST http://localhost:3002/auth/logout \
  -H "Content-Type: application/json" \
  --cookie "refreshToken=<REFRESH_TOKEN_COOKIE>"
```

**Response (200 OK):**
```json
{
  "message": "User logged out successfully. Refresh token revoked."
}
```

### 6. Request Password Reset

**Request:**
```bash
curl -X POST http://localhost:3002/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.test"
  }'
```

**Response (200 OK):**
```json
{
  "message": "Password reset email sent"
}
```

ℹ️ **Note:** Password reset token valid for 1 hour.

### 7. Reset Password

**Request:**
```bash
curl -X POST http://localhost:3002/auth/reset-password \
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
  "message": "Password reset successfully"
}
```

### 8. Change Password (Authenticated)

**Request:**
```bash
curl -X POST http://localhost:3002/auth/change-password \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPassword123",
    "newPassword": "NewStr0ngPass!"
  }'
```

**Response (200 OK):**
```json
{
  "message": "Password changed successfully"
}
```

### 9. Reset Organization API Secret (Admin Only)

**Request:**
```bash
curl -X POST http://localhost:3002/auth/reset-secret \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "YourCurrentPassword123"
  }'
```

**Response (200 OK):**
```json
{
  "message": "API secret reset successfully",
  "apiSecret": "sk_live_newSecret789xyz"
}
```

⚠️ **Warning:** API secret shown only once. Store securely.

### 10. Get Organization API Key

**Request:**
```bash
curl -X GET http://localhost:3002/auth/organization/keys \
  -H "Authorization: Bearer <JWT_TOKEN>"
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
curl -X GET http://localhost:3002/users \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```

**Response (200 OK):**
```json
[
  {
    "_id": "64a8b9c7d2f3e4a1b2c3d4e7",
    "email": "user1@acme.test",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "user",
    "organizationId": "64a8b9c7d2f3e4a1b2c3d4e5"
  },
  {
    "_id": "64a8b9c7d2f3e4a1b2c3d4e8",
    "email": "user2@acme.test",
    "firstName": "Bob",
    "lastName": "Smith",
    "role": "user",
    "organizationId": "64a8b9c7d2f3e4a1b2c3d4e5"
  }
]
```

### 12. Create User in Organization (Admin Only)

**Request:**
```bash
curl -X POST http://localhost:3002/users \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
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
  "_id": "64a8b9c7d2f3e4a1b2c3d4e9",
  "email": "newuser@acme.test",
  "firstName": "Alice",
  "lastName": "Johnson",
  "role": "user",
  "organizationId": "64a8b9c7d2f3e4a1b2c3d4e5"
}
```

ℹ️ **Note:** Role is forced to 'user'. Sends welcome email.

### 13. Delete User (Admin Only)

**Request:**
```bash
curl -X DELETE http://localhost:3002/users/<USER_ID> \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```

**Response (200 OK):**
```json
{
  "message": "User deleted successfully"
}
```

⚠️ **Warning:** Self-deletion prevented. User must belong to admin's organization.

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

**Login Response:**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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
- **MVC Architecture**: Controllers handle HTTP requests/responses, Services contain business logic, Models define data schemas
- **Separation of Concerns**: Authentication logic separated from user management, utilities isolated in dedicated modules

**Key Components:**
- **Controllers** ([src/controllers/](src/controllers/))
  - [authController.js](src/controllers/authController.js) – Organization registration, user auth, password management, API key operations
  - [usersController.js](src/controllers/usersController.js) – User CRUD operations (admin only)
  
- **Services** ([src/services/](src/services/))
  - [authService.js](src/services/authService.js) – Business logic for authentication, token management, password operations
  
- **Models** ([src/models/](src/models/))
  - [Organization.js](src/models/Organization.js) – Company data with API credentials
  - [User.js](src/models/User.js) – User accounts with roles and organization association
  - [RefreshToken.js](src/models/RefreshToken.js) – Refresh token storage with TTL (7 days)
  - [PasswordResetToken.js](src/models/PasswordResetToken.js) – Password reset tokens with TTL (1 hour)
  
- **Routes** ([src/routes/](src/routes/))
  - [authRoutes.js](src/routes/authRoutes.js) – Authentication and password endpoints
  - [usersRoutes.js](src/routes/usersRoutes.js) – User management endpoints (admin protected)
  
- **Utilities** ([src/utils/](src/utils/))
  - [cryptoUtils.js](src/utils/cryptoUtils.js) – API key/secret generation
  - [emailSender.js](src/utils/emailSender.js) – Welcome emails and password reset notifications
  - [logger.js](src/utils/logger.js) – Winston logger with daily file rotation
  - [validationSchemas.js](src/utils/validationSchemas.js) – Joi validation schemas

**Security Features:**
- Password hashing with bcryptjs (salt rounds: 10)
- API secret hashing (never stored in plaintext)
- JWT token signing and verification
- Role-based access control (RBAC)
- Organization-based data isolation
- Self-deletion prevention
- Admin role elevation prevention
- Rate limiting on login endpoint (50 req/15min per IP)

**Logging Infrastructure:**
- Winston logger with structured JSON format
- Daily rotating file transports (combined/error logs)
- Console transport with colorized output
- Request tracking with unique IDs
- Audit logging for sensitive operations

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

### Authentication Flows

**Organization Registration:**
1. Validates required fields (orgName, email, password, firstName, lastName, country, city, address)
2. Checks for duplicate organization name and email
3. Generates API credentials:
   - `apiKey`: format `pk_live_<random>` (public)
   - `apiSecret`: format `sk_live_<random>` (private, hashed with bcryptjs salt 10)
4. Creates Organization document with hashed API secret
5. Creates admin User with hashed password (bcryptjs salt 10)
6. Sends welcome email to admin (non-blocking)
7. Returns plaintext `apiSecret` (visible only once)

**User Registration:**
1. Validates required fields and checks organizationId existence
2. Verifies email uniqueness
3. Hashes password with bcryptjs (salt 10)
4. Creates User with role `user` and organization association
5. Sends welcome email to new user (non-blocking)
6. Returns created user details

**Login Flow:**
1. Finds user by email
2. Compares password against hash using bcryptjs
3. Generates `accessToken` (15 min, payload: `{ userId, organizationId, role }`) signed with `JWT_SECRET`
4. Generates `refreshToken` (7 days) signed with `REFRESH_TOKEN_SECRET`
5. Stores refreshToken in database
6. Returns both tokens and user info
7. **Rate limited to 50 requests per 15 minutes per IP**

**Token Refresh:**
1. Validates refreshToken exists in database (not revoked)
2. Verifies token signature with `REFRESH_TOKEN_SECRET`
3. Fetches user for current role information
4. Generates new `accessToken` (15 min)
5. Returns new access token

**Logout:**
1. Deletes refreshToken from database
2. User cannot refresh access token after logout

**Password Reset Flow:**
1. **Forgot Password**: 
   - Finds user by email
   - Generates random reset token
   - Stores token in database (expires 1 hour)
   - Sends email with reset link including token and userId
   - **Always returns success message to prevent account enumeration**
2. **Reset Password**:
   - Validates token from database by userId
   - Verifies token matches
   - Hashes new password with bcryptjs (salt 10)
   - Updates User passwordHash
   - Deletes used token from database

**Change Password:**
1. Requires authentication via `x-user-id` header (from API Gateway)
2. Verifies current password against user's hash
3. Hashes new password with bcryptjs (salt 10)
4. Updates User passwordHash

**Reset API Secret:**
1. Requires `admin` role (via `x-role` header from API Gateway)
2. Verifies user's current password
3. Generates new `apiSecret` (format: `sk_live_<random>`)
4. Hashes and stores new secret
5. Returns plaintext secret (visible only once)

**Get Organization Keys:**
1. Requires authentication via `x-org-id` and `x-user-id` headers
2. Finds organization by ID
3. Returns public `apiKey` (not secret)

**API Key Validation (Internal):**
1. Finds organization by apiKey
2. Compares provided plaintext apiSecret against stored hash
3. Returns organization ID and name on success
4. Used by API Gateway for B2B authentication

### Users Management Flows

**GET /users:**
1. Requires `admin` or `superadmin` role (via `x-role` header)
2. Requires organization context (via `x-org-id` header)
3. Queries users filtered by organizationId and role='user' (hides admins/superadmins)
4. Returns array of users with passwordHash excluded

**POST /users:**
1. Requires `admin` or `superadmin` role
2. Requires organization context (via `x-org-id` header)
3. **Forces role to 'user'** (prevents role elevation)
4. Validates email uniqueness
5. Hashes password with bcryptjs (salt 10)
6. Creates User with forced organizationId from admin's context
7. Sends welcome email to new user (non-blocking)
8. Returns created user details

**DELETE /users/:id:**
1. Requires `admin` or `superadmin` role
2. Requires organization context (via `x-org-id` header)
3. Prevents self-deletion
4. Verifies user belongs to admin's organization (data isolation)
5. Only superadmins can delete admin users
6. Deletes user from database

**Health Check:**
- Reports service status and Mongoose connection state (1 = Connected, other = Disconnected)

### Validation Rules (Joi)

- **Email**: Valid email format (contains `@` and domain with dot), required
- **Password**: Minimum 8 characters, required for registration/login/reset
- **Required fields**: All required fields validated via Joi schemas
- **Error format**: 400 status with descriptive messages

### Authentication Methods

**User Login (JWT):**
1. User provides email and password
2. Receives `accessToken` (15 min) and `refreshToken` (7 days)
3. Uses accessToken in `Authorization: Bearer <token>` header
4. API Gateway verifies token signature
5. When accessToken expires, client uses refreshToken to obtain new accessToken
6. On logout, refreshToken is revoked

**System/B2B (API Key):**
1. Organization receives `apiKey` and `apiSecret` at registration
2. Uses both in `x-api-key` and `x-api-secret` headers
3. API Gateway validates credentials with `/auth/internal/validate-api-key`
4. No token expiration (persistent until reset via `/reset-secret`)

**Role-Based Access:**
1. Tokens include user role (`superadmin`, `admin`, `user`)
2. API Gateway forwards role via `x-role` header
3. Services enforce access control (e.g., `/reset-secret` requires admin role)

### Implemented Features

✅ **Rate Limiting**: `/login` endpoint limited to 50 requests per 15 minutes per IP  
✅ **Password Reset Flow**: `forgot-password` and `reset-password` with 1-hour token expiration  
✅ **Welcome Emails**: Automatic welcome emails to newly registered users via nodemailer  
✅ **Password Change**: `/change-password` endpoint with current password verification  
✅ **Token Refresh/Revocation**: `refresh` endpoint for new access tokens, `logout` revokes tokens  
✅ **Role-Based Access Control**: `superadmin`, `admin`, and `user` roles with endpoint protection  
✅ **Users Management**: Full CRUD operations for admins with organization isolation  
✅ **Structured Logging**: Winston with daily rotation for all events, errors, and audit trails  
✅ **API Secret Reset**: `/reset-secret` endpoint with password confirmation  
✅ **Organization Keys Retrieval**: `GET /auth/organization/keys` returns public API key  
✅ **Schema Validation**: Joi validation for all input data  
✅ **Data Isolation**: Organization-based access control for all operations  
✅ **Security Controls**: Self-deletion prevention, role elevation prevention, password verification

---

## Testing

The Auth Service includes comprehensive integration tests that verify endpoint behavior, request validation, authentication flows, role-based access control, and interaction with external dependencies (MongoDB, email service).

**Test Framework:**
- **jest** 30.2.0 – Test runner with ES Modules support
- **supertest** 7.2.2 – HTTP assertions
- **Mocking**: Jest mocks for AuthService, User, RefreshToken, emailSender

**Test Coverage:** 31 integration tests across all endpoints

### Test Files

**tests/auth.test.js** – Comprehensive integration tests for authentication and users management

### Test Suites

**Organization Registration** (`POST /auth/register-organization` – 3 tests):
- ✅ Happy path: Successful organization and admin user registration with API key generation (201)
- ✅ Duplicate email validation: Rejects duplicate email registrations (400)
- ✅ Password validation: Enforces minimum 8-character password requirement via Joi (400)

**User Registration** (`POST /auth/register-user` – 5 tests):
- ✅ Success: Registers user with admin authorization (201)
- ✅ Authorization: Rejects registration without admin role (403)
- ✅ Validation: Validates duplicate email, missing organization ID, and required fields (400/404)

**User Login** (`POST /auth/login` – 2 tests):
- ✅ Success: Authenticates user and returns JWT access token and refresh token (200)
- ✅ Failure: Rejects invalid credentials with 401 error

**Token Refresh** (`POST /auth/refresh` – 2 tests):
- ✅ Success: Generates new access token using valid refresh token stored in database (200)
- ✅ Failure: Rejects invalid, expired, or revoked refresh tokens with 403 error

**User Logout** (`POST /auth/logout` – 2 tests):
- ✅ Success: Revokes refresh token from database, preventing future token refreshes (200)
- ✅ Failure: Rejects refresh attempts with revoked token (403 after logout)

**API Key Validation** (`POST /auth/internal/validate-api-key` – 4 tests):
- ✅ Success: Validates correct API key and secret pair (200)
- ✅ Failure: Rejects invalid API key, invalid secret, and missing credentials (400/401)

**API Secret Reset** (`POST /auth/reset-secret` – 3 tests):
- ✅ Success: Generates new API secret for organization (200)
- ✅ Authorization: Rejects non-admin users (403)
- ✅ Validation: Validates missing context headers (401)

**Password Reset Flow** (`POST /auth/forgot-password` – 2 tests; `POST /auth/reset-password` – 3 tests):
- ✅ Forgot password: Always returns success message (prevents account enumeration) (200)
- ✅ Reset password success: Successful reset with valid token (200)
- ✅ Reset password failure: Rejects invalid token and validates short password (400)

**Password Change** (`POST /auth/change-password` – 2 tests):
- ✅ Success: Changes password with current password verification (200)
- ✅ Validation: Rejects missing required fields (400)

**Users Management - GET** (`GET /users` – 3 tests):
- ✅ Success: Returns users list for admin's organization (200)
- ✅ Authorization: Rejects non-admin users (403)
- ✅ Validation: Handles missing organization context (403)

**Users Management - POST** (`POST /users` – 4 tests):
- ✅ Success: Creates user with role='user' in admin's organization (201)
- ✅ Authorization: Rejects non-admin users (403)
- ✅ Validation: Validates duplicate email and missing fields (400)

**Users Management - DELETE** (`DELETE /users/:id` – 2 tests):
- ✅ Success: Deletes user from organization (200)
- ✅ Authorization: Rejects non-admin users (403)

**Health Check** (`GET /health` – 1 test):
- ✅ Returns service status and database connection state (200)

**Security & Edge Cases** (5 tests):
- ✅ Validates invalid email format (400)
- ✅ Validates missing required fields (400)
- ✅ Ensures passwordHash not exposed in responses
- ✅ Tests RBAC enforcement across endpoints
- ✅ Tests organization data isolation

### Running Tests

**Command:**
```bash
npm test
```

**Configuration:**
- Uses Jest with ES Modules support: `cross-env NODE_OPTIONS=--experimental-vm-modules jest --verbose`
- Tests run in isolated environment with mocked dependencies
- No real MongoDB or email service connection required
- All mocks defined before importing application code using `jest.unstable_mockModule`
- Environment variables set in test file (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`)

**Mocked Dependencies:**
- `AuthService` – Business logic layer
- `RefreshToken` – Database model
- `User` – Database model (partial)
- `logger` – Winston logger
- `emailSender` – Nodemailer email service

### Test Coverage

**Request Validation:**
- Verifies proper HTTP status codes for invalid inputs
- Tests short password, missing required fields, invalid email format

**Security:**
- Tests duplicate credentials rejection
- Validates invalid passwords
- Tests unauthorized token usage
- Ensures passwordHash never exposed in responses

**Authentication Flows:**
- Complete flows: login, token generation, token refresh, logout
- Password reset flow (forgot + reset with token)
- Password change with verification

**Role-Based Access Control (RBAC):**
- Validates admin-only endpoints (users management, reset-secret)
- Tests role enforcement and unauthorized access rejection (403)
- Organization-based data isolation

**Data Isolation:**
- Tests organization context validation
- Verifies admins can only manage users from their organization
- Tests self-deletion prevention

---

## License

MIT