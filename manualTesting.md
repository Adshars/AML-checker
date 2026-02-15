# Manual Testing Guide - AML Checker Platform

Manual testing guide for the AML Checker platform using Postman. The guide targets the API Gateway (all requests go through it), and reflects the current Docker Compose setup where backend services are internal by default.

## Prerequisites
- Postman installed
- Stack running: `docker compose up --build`
- Services accessible:
  - API Gateway: http://localhost:8080
  - Frontend: http://localhost (Vite dev server on 5173)
  - Yente: http://localhost:8000

Note: Auth Service, Core Service, and OP-Adapter are internal by default in Docker Compose. If you want direct access to those services, uncomment their `ports` sections in `docker-compose.yml`.

## Environment Variables (Postman)

Create a Postman environment with these variables:
```
gateway_url = http://localhost:8080
superadmin_token = (set after SuperAdmin login)
superadmin_email = super@admin.com
superadmin_password = admin123
access_token = (set after login)
api_key = (set after org registration)
api_secret = (set after org registration)
org_id = (set after org registration)
user_id = (set after login)
```

---

## Test Cases

### 0. SuperAdmin Login (Prerequisite)
**Endpoint**: `POST {{gateway_url}}/auth/login`

**Purpose**: Authenticate as SuperAdmin.

**Prerequisite**: Seed SuperAdmin in MongoDB (see [README.md](README.md)).

**Request Body**:
```json
{
  "email": "super@admin.com",
  "password": "admin123"
}
```

**Expected Response (200)**:
- `accessToken` (JWT) -> save to `{{superadmin_token}}`
- `user.role` = `superadmin`
- Refresh token is set as **HttpOnly cookie** (not returned in JSON)

---

### 1. Organization Registration (SuperAdmin Only)
**Endpoint**: `POST {{gateway_url}}/auth/register-organization`

**Headers**:
- `Authorization: Bearer {{superadmin_token}}`

**Request Body**:
```json
{
  "orgName": "ACME Corporation",
  "country": "US",
  "city": "New York",
  "address": "123 Business Ave, New York, NY 10001",
  "email": "admin@acme.test",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Anderson"
}
```

**Expected Response (201)**:
- `organization.id` -> save as `{{org_id}}`
- `organization.apiKey` -> save as `{{api_key}}`
- `organization.apiSecret` -> save as `{{api_secret}}`
- `user.role` = `admin`

---

### 1a. Organization Registration - Missing Auth (Negative)
**Endpoint**: `POST {{gateway_url}}/auth/register-organization`

**Expected Response (401)**:
```json
{ "error": "Unauthorized" }
```

---

### 1b. Organization Registration - Non-SuperAdmin (Negative)
**Endpoint**: `POST {{gateway_url}}/auth/register-organization`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Expected Response (403)**:
```json
{ "error": "Forbidden" }
```

---

### 2. User Login (Admin)
**Endpoint**: `POST {{gateway_url}}/auth/login`

**Request Body**:
```json
{
  "email": "admin@acme.test",
  "password": "SecurePass123!"
}
```

**Expected Response (200)**:
- `accessToken` -> save as `{{access_token}}`
- `user.role` = `admin`
- Refresh token set as HttpOnly cookie

---

### 3. Create User (Admin)
**Endpoint**: `POST {{gateway_url}}/users`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Request Body**:
```json
{
  "email": "paneluser@acme.test",
  "password": "SecurePass456!",
  "firstName": "Panel",
  "lastName": "User"
}
```

**Expected Response (201)**:
- `user.role` = `user`
- `user.organizationId` = `{{org_id}}`

---

### 4. Register User via Auth Endpoint (Admin)
**Endpoint**: `POST {{gateway_url}}/auth/register-user`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Request Body**:
```json
{
  "email": "user@acme.test",
  "password": "SecurePass456!",
  "firstName": "Alice",
  "lastName": "Johnson",
  "organizationId": "{{org_id}}"
}
```

**Expected Response (201)**:
- `user.role` = `user`
- `user.organizationId` = `{{org_id}}`

---

### 5. Refresh Access Token (Cookie-Based)
**Endpoint**: `POST {{gateway_url}}/auth/refresh`

**Notes**:
- This endpoint uses the **refresh token cookie**. Do not send refresh token in body.

**Expected Response (200)**:
- `accessToken` returned and can replace `{{access_token}}`

---

### 6. Sanctions Check (JWT)
**Endpoint**: `GET {{gateway_url}}/sanctions/check?name=Vladimir%20Putin`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Expected Response (200)**:
- `hits_count` present
- `data` array present
- `meta.requestId` present

---

### 7. Sanctions Check (API Key)
**Endpoint**: `GET {{gateway_url}}/sanctions/check?name=Vladimir%20Putin`

**Headers**:
- `x-api-key: {{api_key}}`
- `x-api-secret: {{api_secret}}`

**Expected Response (200)**:
- `hits_count` present
- `data` array present

---

### 8. Audit History (Paginated)
**Endpoint**: `GET {{gateway_url}}/sanctions/history?page=1&limit=10`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Expected Response (200)**:
- `data` array
- `meta.totalItems`, `meta.totalPages`, `meta.currentPage`, `meta.itemsPerPage`

---

### 9. Audit History Filters
**Endpoint**: `GET {{gateway_url}}/sanctions/history?search=Putin&hasHit=true`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Expected Response (200)**:
- Filtered results only

---

### 10. Stats
**Endpoint**: `GET {{gateway_url}}/sanctions/stats`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Expected Response (200)**:
- `totalChecks`, `sanctionHits`, `pepHits`, `recentLogs`

---

## Bonus Tests

### Rate Limiting
- Send 21 requests to `/auth/login` within 15 minutes -> expect 429
- Send 101 requests to `/sanctions/check` within 15 minutes -> expect 429

### Password Reset
1. `POST /auth/forgot-password`
2. Use token from email/logs
3. `POST /auth/reset-password`

### Logout
1. `POST /auth/logout`
2. `POST /auth/refresh` should return 403

---

## Notes

- Refresh tokens are **HttpOnly cookies**, not returned in JSON.
- Backend services are internal unless ports are exposed in `docker-compose.yml`.
- For detailed behaviors and error messages, see individual service READMEs.
