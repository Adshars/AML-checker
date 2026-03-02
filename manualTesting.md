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
superadmin_password = superadmin
access_token = (set after login)
api_key = (set after org registration)
api_secret = (set after org registration)
org_id = (set after org registration)
user_id = (set after login)
panel_user_id = (set after user creation)
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
  "password": "superadmin"
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
{ "error": "Only SuperAdmin can register organizations" }
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

### 3. Create User via Panel (Admin)
**Endpoint**: `POST {{gateway_url}}/users`

**Note**: Internal admin mechanism — `organizationId` is always taken from the admin's JWT context, not from the request body. The body value would be silently ignored even if sent.

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
- `user.id` -> save as `{{panel_user_id}}`

---

### 4. Register User via Auth Endpoint (Admin / SuperAdmin)
**Endpoint**: `POST {{gateway_url}}/auth/register-user`

**Note**: Allows dynamic assignment of `organizationId` from the request body. Intended for SuperAdmin workflows or external integrations assigning users to a specific organization. Unlike `POST /users`, the `organizationId` must be provided explicitly.

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
- `meta.timestamp` present

---

### 7. Sanctions Check (API Key)
**Endpoint**: `GET {{gateway_url}}/sanctions/check?name=Vladimir%20Putin`

**Headers**:
- `x-api-key: {{api_key}}`
- `x-api-secret: {{api_secret}}`

**Expected Response (200)**:
- `hits_count` present
- `data` array present
- `meta.requestId` present (always returned by op-adapter regardless of auth method)

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

## Admin Operations

### 11. List Users in Organization
**Endpoint**: `GET {{gateway_url}}/users`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Expected Response (200)**:
- `data` array of users
- Every item in `data` has `organizationId` equal to the admin's organization (`{{org_id}}`)

---

### 12. Delete User
**Endpoint**: `DELETE {{gateway_url}}/users/{{panel_user_id}}`

**Prerequisite**: `{{panel_user_id}}` set from Test 3.

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Expected Response (200)**:
- Success message confirming deletion

**Verification**: Repeat `GET {{gateway_url}}/users` — the deleted user's ID must not appear in the response.

---

### 13. Get Organization API Key
**Endpoint**: `GET {{gateway_url}}/auth/organization/keys`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Expected Response (200)**:
```json
{ "apiKey": "..." }
```

**Note**: Only `apiKey` is returned here. The `apiSecret` is never exposed after initial registration — use Test 14 to rotate it.

---

### 14. Reset API Secret
**Endpoint**: `POST {{gateway_url}}/auth/reset-secret`

**Note**: Admin-only. Requires current password as a security confirmation. After reset, the old `{{api_secret}}` is invalidated — update your environment variable.

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Request Body**:
```json
{
  "password": "SecurePass123!"
}
```

**Expected Response (200)**:
```json
{
  "message": "API secret reset successfully",
  "apiKey": "...",
  "newApiSecret": "..."
}
```

- `newApiSecret` -> update `{{api_secret}}`

---

## Negative / Security Tests

### 15. Sanctions Check - Missing Name Parameter
**Endpoint**: `GET {{gateway_url}}/sanctions/check` (no `name` query param)

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Expected Response (400)**:
```json
{ "error": "Missing name parameter" }
```

---

### 16. Stats - Direct Call Without Auth (Gateway blocks)
**Endpoint**: `GET {{gateway_url}}/sanctions/stats` (no Authorization header)

**Expected Response (401)**:
```json
{ "error": "Unauthorized" }
```

---

### 17. Superadmin History Access (Cross-Organization)
**Endpoint**: `GET {{gateway_url}}/sanctions/history?page=1&limit=20`

**Note**: SuperAdmin bypasses the `x-org-id` filter. The response may contain audit logs from **multiple organizations**. Regular admin users are restricted to their own organization's data.

**Headers**:
- `Authorization: Bearer {{superadmin_token}}`

**Expected Response (200)**:
- `data` array potentially containing records from different organizations
- `meta` pagination fields present

---

## Bonus Tests

### Rate Limiting
- Send 21 requests to `/auth/login` within 15 minutes -> expect 429
- Send 101 requests to `/sanctions/check` within 15 minutes -> expect 429

### Password Reset
1. `POST /auth/forgot-password`
   - Body: `{ "email": "user@acme.test" }`
2. Use token from email/logs
3. `POST /auth/reset-password`
   - Body: `{ "userId": "...", "token": "...", "newPassword": "SecurePass789!" }`

### Change Password (Authenticated User)
**Note**: Different flow from Password Reset — requires an active session (JWT), not a reset token.

1. `POST /auth/change-password`
   - Headers: `Authorization: Bearer {{access_token}}`
   - Body:
     ```json
     {
       "currentPassword": "SecurePass123!",
       "newPassword": "NewSecurePass999!"
     }
     ```
2. Verify: `POST /auth/login` with new password returns 200
3. Verify: `POST /auth/login` with old password returns 401

### Logout
1. `POST /auth/logout`
2. `POST /auth/refresh` should return 403

---

## Notes

- Refresh tokens are **HttpOnly cookies**, not returned in JSON.
- Backend services are internal unless ports are exposed in `docker-compose.yml`.
- Rate limiting is enforced exclusively by the API Gateway (`authLimiter` max 20, `apiLimiter` max 100 per 15 min window).
- For detailed behaviors and error messages, see individual service READMEs.
