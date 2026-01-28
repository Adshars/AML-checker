# Manual Testing Guide - AML Checker Platform

Comprehensive manual testing guide using Postman for the AML Checker microservice platform. This document contains 20 test cases covering authentication, organization management, sanctions checking, audit history, and error handling.

## Prerequisites
- Postman installed
- AML Checker stack running: `docker compose up --build`
- Services accessible:
  - API Gateway: http://localhost:8080
  - Auth Service: http://localhost:3002
  - Core Service: http://localhost:3005 (debug)
  - OP Adapter: http://localhost:3001

## Environment Variables (Postman)
Create a Postman environment with these variables:
```
gateway_url = http://localhost:8080
auth_url = http://localhost:3002
core_url = http://localhost:3005
superadmin_token = (auto-populated after SuperAdmin login)
superadmin_email = super@admin.com
superadmin_password = admin123
access_token = (auto-populated after login)
refresh_token = (auto-populated after login)
api_key = (auto-populated after org registration)
api_secret = (auto-populated after org registration)
org_id = (auto-populated after org registration)
user_id = (auto-populated after login)
```

---

## Test Cases

### **0. SuperAdmin Login (Prerequisites)**
**Endpoint**: `POST {{gateway_url}}/auth/login`

**Purpose**: Authenticate as SuperAdmin to perform organization registration

**Prerequisites**: SuperAdmin must be created in MongoDB. See [Initial Setup](README.md#initial-setup-creating-the-first-superadmin) for SuperAdmin seeding instructions.

**Request Body**:
```json
{
  "email": "super@admin.com",
  "password": "admin123"
}
```

**Expected Response** (200):
- `accessToken` (JWT) → save as `{{superadmin_token}}`
- `refreshToken` (JWT)
- `user.role` = "superadmin"

**Assertions**:
- Status code is 200
- `user.role` equals "superadmin"
- Response contains `accessToken` and `refreshToken`

**Important**: This test MUST run first - it provides the SuperAdmin JWT needed for Test 1.

---

### **1. Organization Registration (SuperAdmin Protected)**
**Endpoint**: `POST {{gateway_url}}/auth/register-organization`

**Purpose**: Register a new organization with admin user using SuperAdmin JWT (protected endpoint)

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

**Expected Response** (201):
- `organization.id` → save as `{{org_id}}`
- `organization.apiKey` (format: `pk_live_...`) → save as `{{api_key}}`
- `organization.apiSecret` (format: `sk_live_...`) → save as `{{api_secret}}`
- `user.role` = "admin"
- Welcome email sent to admin@acme.test (check logs or Ethereal preview URL)

**Assertions**:
- Status code is 201
- Response contains `organization.apiKey`
- Response contains `organization.apiSecret`
- `organization.name` equals "ACME Corporation"
- Check logs: should see welcome email sent to admin

**Security Note**: This endpoint now requires SuperAdmin JWT. Without it, returns 401 Unauthorized.

---

### **1a. Organization Registration - Missing SuperAdmin Auth (Negative)**
**Endpoint**: `POST {{gateway_url}}/auth/register-organization`

**Purpose**: Verify endpoint is protected and requires SuperAdmin JWT

**Request Body** (same as Test 1, but NO Authorization header):
```json
{
  "orgName": "Unauthorized Corp",
  "country": "US",
  "city": "Boston",
  "address": "789 Test Lane",
  "email": "test@unauthorized.test",
  "password": "SecurePass123!",
  "firstName": "Test",
  "lastName": "User"
}
```

**Expected Response** (401):
```json
{
  "error": "Unauthorized"
}
```

**Assertions**:
- Status code is 401
- Endpoint is protected (no JWT = denied)

---

### **1b. Organization Registration - Non-SuperAdmin User (Negative)**
**Endpoint**: `POST {{gateway_url}}/auth/register-organization`

**Purpose**: Verify only SuperAdmin role can register organizations (non-admin users cannot)

**Headers**:
- `Authorization: Bearer {{access_token}}` (regular user token, NOT superadmin)

**Request Body** (same as Test 1):
```json
{
  "orgName": "Forbidden Corp",
  "country": "US",
  "city": "Chicago",
  "address": "999 Admin Lane",
  "email": "test@forbidden.test",
  "password": "SecurePass123!",
  "firstName": "Test",
  "lastName": "User"
}
```

**Expected Response** (403):
```json
{
  "error": "Forbidden - SuperAdmin role required"
}
```

**Assertions**:
- Status code is 403
- Error message indicates insufficient permissions
- Organization is NOT created

---

### **2. Organization Registration - Duplicate Org Name (Negative)**
**Endpoint**: `POST {{gateway_url}}/auth/register-organization`

**Purpose**: Verify system rejects duplicate organization names

**Request Body**:
```json
{
  "orgName": "ACME Corporation",
  "country": "GB",
  "city": "London",
  "address": "456 Corporate Street",
  "email": "another@acme.test",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Expected Response** (400):
```json
{
  "error": "Organization with this name is already registered"
}
```

**Assertions**:
- Status code is 400
- Error message mentions duplicate organization

---

### **3. Organization Registration - Invalid Email (Negative)**
**Endpoint**: `POST {{gateway_url}}/auth/register-organization`

**Purpose**: Verify email validation using Joi schema

**Request Body**:
```json
{
  "orgName": "Test Corp",
  "country": "US",
  "city": "Boston",
  "address": "789 Test Lane",
  "email": "invalid-email",
  "password": "SecurePass123!",
  "firstName": "Test",
  "lastName": "User"
}
```

**Expected Response** (400):
```json
{
  "error": "Invalid email (must contain @ and a domain with a dot)"
}
```

**Assertions**:
- Status code is 400
- Error message contains "Invalid email"

---

### **4. Organization Registration - Weak Password (Negative)**
**Endpoint**: `POST {{gateway_url}}/auth/register-organization`

**Purpose**: Verify password minimum length requirement (8 characters)

**Request Body**:
```json
{
  "orgName": "WeakPass Corp",
  "country": "US",
  "city": "Boston",
  "address": "789 Test Lane",
  "email": "test@weakpass.test",
  "password": "weak",
  "firstName": "Test",
  "lastName": "User"
}
```

**Expected Response** (400):
```json
{
  "error": "Password must be at least 8 characters long"
}
```

**Assertions**:
- Status code is 400
- Error message mentions minimum password length

---

### **2. Organization Registration - Duplicate Org Name (Negative)**
**Endpoint**: `POST {{gateway_url}}/auth/register-organization`

**Headers**:
- `Authorization: Bearer {{superadmin_token}}`

**Purpose**: Verify system rejects duplicate organization names

**Request Body**:
```json
{
  "orgName": "ACME Corporation",
  "country": "GB",
  "city": "London",
  "address": "456 Corporate Street",
  "email": "another@acme.test",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Expected Response** (400):
```json
{
  "error": "Organization with this name is already registered"
}
```

**Assertions**:
- Status code is 400
- Error message mentions duplicate organization

---

### **3. Organization Registration - Invalid Email (Negative)**
**Endpoint**: `POST {{gateway_url}}/auth/register-organization`

**Headers**:
- `Authorization: Bearer {{superadmin_token}}`

**Purpose**: Verify email validation using Joi schema

**Request Body**:
```json
{
  "orgName": "Test Corp",
  "country": "US",
  "city": "Boston",
  "address": "789 Test Lane",
  "email": "invalid-email",
  "password": "SecurePass123!",
  "firstName": "Test",
  "lastName": "User"
}
```

**Expected Response** (400):
```json
{
  "error": "Invalid email (must contain @ and a domain with a dot)"
}
```

**Assertions**:
- Status code is 400
- Error message contains "Invalid email"

---

### **4. Organization Registration - Weak Password (Negative)**
**Endpoint**: `POST {{gateway_url}}/auth/register-organization`

**Headers**:
- `Authorization: Bearer {{superadmin_token}}`

**Purpose**: Verify password minimum length requirement (8 characters)

**Request Body**:
```json
{
  "orgName": "WeakPass Corp",
  "country": "US",
  "city": "Boston",
  "address": "789 Test Lane",
  "email": "test@weakpass.test",
  "password": "weak",
  "firstName": "Test",
  "lastName": "User"
}
```

**Expected Response** (400):
```json
{
  "error": "Password must be at least 8 characters long"
}
```

**Assertions**:
- Status code is 400
- Error message mentions minimum password length

---

### **5. Create User via Admin Panel (POST /users)**
**Endpoint**: `POST {{gateway_url}}/users`

**Headers**:
- `Authorization: Bearer {{access_token}}` (admin token from Test 1)

**Purpose**: Create new user in organization using admin panel (alternative to /auth/register-user). Sends welcome email to new user.

**Request Body**:
```json
{
  "email": "paneluser@acme.test",
  "password": "SecurePass456!",
  "firstName": "Panel",
  "lastName": "User"
}
```

**Expected Response** (201):
- `user.role` = "user" (role forced to 'user')
- `user.email` = "paneluser@acme.test"
- `user.organizationId` = `{{org_id}}` (auto-assigned from admin context)
- Welcome email sent to paneluser@acme.test (check logs or Ethereal)

**Assertions**:
- Status code is 201
- `user.role` equals "user" (cannot set admin via this endpoint)
- User is linked to admin's organization
- Check logs: should see welcome email sent

---

### **6. User Registration (Positive)**
**Endpoint**: `POST {{gateway_url}}/auth/register-user`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Purpose**: Register additional user in existing organization using protected endpoint. Sends welcome email.

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

**Expected Response** (201):
- `user.role` = "user"
- `user.email` = "user@acme.test"
- `user.organizationId` = `{{org_id}}`
- Welcome email sent to user@acme.test (check logs or Ethereal)

**Assertions**:
- Status code is 201
- `user.role` equals "user"
- User is linked to correct organization
- Check logs: should see welcome email sent

---

### **7. User Registration - Duplicate Email (Negative)**
**Endpoint**: `POST {{gateway_url}}/auth/register-user`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Purpose**: Verify system rejects duplicate email addresses

**Request Body**:
```json
{
  "email": "admin@acme.test",
  "password": "SecurePass789!",
  "firstName": "Bob",
  "lastName": "Smith",
  "organizationId": "{{org_id}}"
}
```

**Expected Response** (400):
```json
{
  "error": "This email is already registered"
}
```

**Assertions**:
- Status code is 400
- Error message mentions duplicate email

---

### **8. User Registration - Invalid Organization (Negative)**
**Endpoint**: `POST {{gateway_url}}/auth/register-user`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Purpose**: Verify system validates organization existence

**Request Body**:
```json
{
  "email": "newuser@test.test",
  "password": "SecurePass789!",
  "firstName": "Charlie",
  "lastName": "Brown",
  "organizationId": "invalid-org-id-12345"
}
```

**Expected Response** (404):
```json
{
  "error": "Organization does not exist"
}
```

**Assertions**:
- Status code is 404
- Error message mentions organization not found

---

### **9. User Login - Valid Credentials (Positive)**
**Endpoint**: `POST {{gateway_url}}/auth/login`

**Purpose**: Authenticate user and receive JWT tokens

**Request Body**:
```json
{
  "email": "admin@acme.test",
  "password": "SecurePass123!"
}
```

**Expected Response** (200):
- `accessToken` (JWT, 15-minute expiration) → save as `{{access_token}}`
- `refreshToken` (JWT, 7-day expiration) → save as `{{refresh_token}}`
- `user.role` = "admin"
- `user.organizationId` = `{{org_id}}`

**Assertions**:
- Status code is 200
- Response contains `accessToken`
- Response contains `refreshToken`
- Both tokens are valid JWT format

---

### **9. User Login - Valid Credentials (Positive)**
**Endpoint**: `POST {{gateway_url}}/auth/login`

**Purpose**: Authenticate user and receive JWT tokens. Verify role-based redirection works.

**Request Body**:
```json
{
  "email": "admin@acme.test",
  "password": "SecurePass123!"
}
```

**Expected Response** (200):
- `accessToken` (JWT, 15-minute expiration) → save as `{{access_token}}`
- `refreshToken` (JWT, 7-day expiration) → save as `{{refresh_token}}`
- `user.role` = "admin"
- `user.organizationId` = `{{org_id}}`

**Assertions**:
- Status code is 200
- Response contains `accessToken`
- Response contains `refreshToken`
- Both tokens are valid JWT format
- `user.role` is "admin"

**Frontend Verification**: After login, verify you're redirected to `/dashboard` (not `/superadmin` - that's only for superadmin role)

---

### **10. SuperAdmin Login - Role-Based Redirect (Positive)**
**Endpoint**: `POST {{gateway_url}}/auth/login`

**Purpose**: Verify SuperAdmin gets redirected to SuperAdmin portal (/superadmin) when logging in via frontend

**Request Body**:
```json
{
  "email": "super@admin.com",
  "password": "admin123"
}
```

**Expected Response** (200):
- `accessToken` (JWT)
- `refreshToken` (JWT)
- `user.role` = "superadmin"

**Frontend Verification**:
1. Go to http://localhost:5173 (Frontend)
2. Login with superadmin credentials
3. **Should be redirected to `/superadmin`** (SuperAdmin portal)
4. Verify you see organization registration form
5. Verify top navigation shows "New Organization" link (not regular menu)

**Assertions**:
- Status code is 200
- `user.role` = "superadmin"
- Frontend redirects to `/superadmin` (not `/dashboard`)

---

### **11. User Login - Invalid Password (Negative)**
**Endpoint**: `POST {{gateway_url}}/auth/login`

**Purpose**: Verify rejection of incorrect password

**Request Body**:
```json
{
  "email": "admin@acme.test",
  "password": "WrongPassword123!"
}
```

**Expected Response** (401):
```json
{
  "error": "Invalid email or password"
}
```

**Assertions**:
- Status code is 401
- Error message is generic (no user enumeration)

---

### **12. User Login - Non-existent Email (Negative)**
**Endpoint**: `POST {{gateway_url}}/auth/login`

**Purpose**: Verify rejection of non-existent user

**Request Body**:
```json
{
  "email": "nonexistent@test.test",
  "password": "AnyPassword123!"
}
```

**Expected Response** (401):
```json
{
  "error": "Invalid email or password"
}
```

**Assertions**:
- Status code is 401
- Error message does not reveal user doesn't exist

---

### **13. Refresh Access Token (Positive)**
**Endpoint**: `POST {{gateway_url}}/auth/refresh`

**Purpose**: Generate new access token using refresh token

**Request Body**:
```json
{
  "refreshToken": "{{refresh_token}}"
}
```

**Expected Response** (200):
- `accessToken` (new JWT, 15-minute expiration) → update `{{access_token}}`

**Assertions**:
- Status code is 200
- Response contains new `accessToken`
- New token is different from previous one

---

### **14. Refresh Access Token - Revoked Token (Negative)**
**Endpoint**: `POST {{gateway_url}}/auth/refresh`

**Purpose**: Verify rejection of revoked/logged-out refresh token

**Prerequisites**: Execute logout test first to revoke token

**Request Body**:
```json
{
  "refreshToken": "{{refresh_token}}"
}
```

**Expected Response** (403):
```json
{
  "error": "Invalid Refresh Token (logged out?)"
}
```

**Assertions**:
- Status code is 403
- Error message indicates token was revoked

---

### **15. Sanctions Check - Valid Entity with Hits (Positive)**
**Endpoint**: `GET {{gateway_url}}/sanctions/check?name=Vladimir%20Putin`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Purpose**: Perform sanctions check that returns positive hits

**Expected Response** (200):
- `hits_count` > 0
- `data[]` contains entity details
- Each entity has `isSanctioned` and `isPep` flags
- Includes `birthDate`, `nationality`, `country`, `score`

**Assertions**:
- Status code is 200
- `hits_count` > 0
- Response includes `meta.requestId` for tracking
- All entities have required fields

---

### **14. Sanctions Check - No Results (Positive)**
**Endpoint**: `GET {{gateway_url}}/sanctions/check?name=Common%20Name%20John%20Smith`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Purpose**: Perform sanctions check with no matching results

**Expected Response** (200):
- `hits_count` = 0
- `data[]` is empty array

**Assertions**:
- Status code is 200
- `hits_count` equals 0
- `data` is empty array
- Audit log still created (check history)

---

### **15. Sanctions Check - Configurable Parameters (Positive)**
**Endpoint**: `GET {{gateway_url}}/sanctions/check?name=John&limit=20&fuzzy=true&schema=Person`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Purpose**: Test dynamic search parameters (limit, fuzzy, schema filtering)

**Expected Response** (200):
- Results limited to `limit=20` (or less if fewer matches)
- All results have `schema: Person`
- Response includes `search_params` object showing applied filters

**Assertions**:
- Status code is 200
- `data` array length ≤ 20
- All entities match `schema: Person`
- `search_params` shows `limit: 20, fuzzy: true, schema: Person`

---

### **16. Sanctions Check - Missing Authentication (Negative)**
**Endpoint**: `GET {{gateway_url}}/sanctions/check?name=test`

**Purpose**: Verify authentication is required

**Expected Response** (401):
```json
{
  "error": "Unauthorized"
}
```

**Assertions**:
- Status code is 401
- No results returned

---

### **17. Sanctions Check with API Key (Positive)**
**Endpoint**: `GET {{gateway_url}}/sanctions/check?name=Vladimir%20Putin`

**Headers**:
- `x-api-key: {{api_key}}`
- `x-api-secret: {{api_secret}}`

**Purpose**: Perform sanctions check using API Key authentication (B2B)

**Expected Response** (200):
- Results returned successfully
- Audit log records user as "B2B-API-KEY"

**Assertions**:
- Status code is 200
- `hits_count` > 0
- Check audit history to verify user is "B2B-API-KEY"

---

### **18. Audit History - Retrieve with Pagination (Positive)**
**Endpoint**: `GET {{gateway_url}}/sanctions/history?page=1&limit=10`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Purpose**: Retrieve paginated audit log for organization

**Expected Response** (200):
```json
{
  "data": [...],
  "meta": {
    "totalItems": 150,
    "totalPages": 15,
    "currentPage": 1,
    "itemsPerPage": 10
  }
}
```

**Assertions**:
- Status code is 200
- `data` array contains up to 10 items
- `meta.totalPages` calculated correctly
- Each audit entry has required fields (searchQuery, hasHit, hitsCount, createdAt)

---

### **19. Audit History - Filter by Search Query (Positive)**
**Endpoint**: `GET {{gateway_url}}/sanctions/history?search=Putin`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Purpose**: Filter audit history by entity name search

**Expected Response** (200):
- Only entries containing "Putin" in `searchQuery` returned
- Results are case-insensitive

**Assertions**:
- Status code is 200
- All `searchQuery` values contain "Putin" (case-insensitive)
- `meta.totalItems` matches filtered count

---

### **20. Audit History - Filter by Hit Status and Date Range (Positive)**
**Endpoint**: `GET {{gateway_url}}/sanctions/history?hasHit=true&startDate=2025-12-01T00:00:00Z&endDate=2025-12-31T23:59:59Z`

**Headers**:
- `Authorization: Bearer {{access_token}}`

**Purpose**: Filter audit history by multiple criteria

**Expected Response** (200):
- Only entries with `hasHit: true` returned
- All `createdAt` timestamps within date range
- Combined filters work correctly

**Assertions**:
- Status code is 200
- All entries have `hasHit: true`
- All `createdAt` dates are within specified range
- Filters can be combined without issues

---

## Additional Manual Test Scenarios

### **Bonus Test: Rate Limiting on Auth Endpoints**
- Send 11 requests to `/auth/login` within 15 minutes from same IP
- 11th request should return `429 Too Many Requests`
- Verify `RateLimit-*` headers in response

### **Bonus Test: Rate Limiting on API Endpoints**
- Send 101 requests to `/sanctions/check` within 15 minutes
- 101st request should return `429 Too Many Requests`

### **Bonus Test: Password Reset Flow**
1. Request reset: `POST /auth/forgot-password` with admin email
2. Check email (or logs) for reset token
3. Reset password: `POST /auth/reset-password` with token
4. Login with new password

### **Bonus Test: API Secret Reset (Admin Only)**
1. Login as admin user
2. Call `POST /auth/reset-secret` with JWT
3. Verify new `apiSecret` is returned
4. Verify old secret no longer works
5. Verify new secret works for API key auth

### **Bonus Test: Logout (Revoke Refresh Token)**
1. Login to get refresh token
2. Call `POST /auth/logout` with refresh token
3. Attempt to refresh with same token
4. Verify `403 Invalid Refresh Token` error

---

## Postman Collection Tips

### Setting Up Tests
1. Go to each request's **Tests** tab
2. Add pre-built test snippets:
   - Status code verification
   - JSON schema validation
   - Environment variable extraction

### Example Test Script (Extract Tokens)
```javascript
if (pm.response.code === 200 || pm.response.code === 201) {
    var jsonData = pm.response.json();
    if (jsonData.accessToken) {
        pm.environment.set("access_token", jsonData.accessToken);
    }
    if (jsonData.refreshToken) {
        pm.environment.set("refresh_token", jsonData.refreshToken);
    }
    if (jsonData.organization?.apiKey) {
        pm.environment.set("api_key", jsonData.organization.apiKey);
        pm.environment.set("api_secret", jsonData.organization.apiSecret);
        pm.environment.set("org_id", jsonData.organization.id);
    }
}
```

### Environment Variable Extraction
Add post-request script to automatically populate variables for next tests

---

## Test Execution Order (Recommended)

**Phase 1: SuperAdmin & Organization Setup**
1. Test 0 (SuperAdmin login) - GET SUPERADMIN_TOKEN
2. Test 1 (Org registration) - CREATE ORGANIZATION & ORG_ID, API_KEY, API_SECRET
3. Test 1a (Auth check) - VERIFY endpoint is protected
4. Test 1b (Role check) - VERIFY only superadmin can register

**Phase 2: Organization & User Management**
5. Test 2-4 (Validation tests) - VERIFY validation for duplicate, invalid email, weak password
6. Test 5 (Create user via /users) - CREATE USER via admin panel
7. Test 6 (Register user via /auth/register-user) - CREATE USER via protected endpoint
8. Test 7-8 (User validation) - VERIFY duplicate email & invalid org rejection

**Phase 3: Authentication & JWT Tokens**
9. Test 9 (User login) - GET ACCESS_TOKEN & REFRESH_TOKEN
10. Test 10 (SuperAdmin login redirect) - VERIFY role-based frontend redirect
11. Test 11-12 (Login errors) - VERIFY invalid credentials handling
12. Test 13 (Refresh token) - GET NEW ACCESS_TOKEN
13. Test 14 (Revoked token) - VERIFY logged-out token rejection

**Phase 4: Sanctions Checking & Audit Logging**
14. Test 15 (Check with hits) - PERFORM SANCTIONS CHECK, VERIFY audit log created
15. Test 16 (Check no results) - PERFORM CHECK with no hits, VERIFY audit log still created
16. Test 17 (Configurable params) - PERFORM CHECK with limit/fuzzy/schema filters
17. Test 18 (Missing auth) - VERIFY auth required
18. Test 19 (API Key auth) - PERFORM CHECK with API key, VERIFY audit log

**Phase 5: Audit History & Statistics**
19. Test 20 (History pagination) - VERIFY all previous checks appear in audit log
20. Test 21 (History search) - FILTER by entity name
21. Test 22 (History multi-filter) - COMBINE filters (hasHit, date range)
22. Test 23 (Statistics) - RETRIEVE org stats (totalChecks, sanctionHits, pepHits)

**Phase 6: Advanced Operations**
23. Test 24 (Get API keys) - RETRIEVE organization API key (no secret)
24. Test 25 (Reset secret) - REGENERATE API secret
25. Test 26 (Forgot password) - REQUEST reset email, VERIFY email sent
26. Test 27 (Reset password) - CONFIRM password reset, VERIFY new password works
27. Test 28 (Change password) - CHANGE password for authenticated user
28. Test 29 (Logout) - REVOKE refresh token
29. Test 30 (Delete user) - DELETE user, VERIFY self-deletion prevention

**Optional Tests (Bonus)**
30. Rate limiting on auth endpoints (429 check)
31. Rate limiting on API endpoints (429 check)
32. SuperAdmin portal frontend (role-based redirect)

---

## Error Handling Checklist

- [ ] 400 - Missing required fields
- [ ] 400 - Invalid email format
- [ ] 400 - Weak password
- [ ] 401 - Invalid credentials
- [ ] 401 - Missing authentication
- [ ] 401 - Unauthorized (endpoint protected)
- [ ] 403 - Invalid JWT/API Key
- [ ] 403 - Insufficient permissions (non-superadmin register org, non-admin reset-secret)
- [ ] 403 - Self-deletion prevention (cannot delete own user)
- [ ] 404 - Organization not found
- [ ] 429 - Rate limit exceeded
- [ ] 500 - Server error handling
- [ ] 502 - Upstream service unavailable

---

## Performance Notes
- Sanctions check should complete within 2-5 seconds (depends on Yente latency)
- Audit history pagination should be fast even with large datasets
- API Key validation cached for 60 seconds (60x faster than uncached)
- Email sending is non-blocking (doesn't delay API response)
- Monitor response times for potential bottlenecks

---

## Email Testing Checklist

- [ ] Welcome email sent to org admin (after org registration)
- [ ] Welcome email sent to new user (after user creation via /users)
- [ ] Welcome email sent to new user (after user creation via /auth/register-user)
- [ ] Password reset email sent with valid token
- [ ] Email links work correctly (preview URL in logs during development)
- [ ] Ethereal Email preview URLs accessible in logs
- [ ] Email content contains all necessary information (credentials, links, instructions)
- [ ] Timestamps and request IDs are correct in emails

---

## SuperAdmin Feature Testing Checklist

- [ ] SuperAdmin can login with default credentials (Test 0)
- [ ] SuperAdmin can register organizations (Test 1)
- [ ] Regular users cannot register organizations (Test 1b)
- [ ] SuperAdmin is redirected to /superadmin on frontend (Test 10)
- [ ] Regular users are redirected to /dashboard on frontend
- [ ] SuperAdmin can view all organizations' audit logs (superadmin orgId filter)
- [ ] Welcome emails are sent when SuperAdmin creates org

---

## Postman Collection Export Tips

1. **Create Collection** in Postman
2. **Add Requests** for each test case
3. **Add Pre-request Scripts** to generate request IDs, tokens, timestamps
4. **Add Tests** to validate responses and extract variables
5. **Configure Environment** with all variables listed at top
6. **Export Collection** as JSON (Share → Export)
7. **Run Collection** via Collection Runner with saved environment
8. **Generate Report** after run (success/failure/timing breakdown)

---

## Conclusion
These **30 manual test cases** (expanded from original 20) provide comprehensive coverage of the AML Checker platform's core functionality, including:
- **SuperAdmin workflow** (org registration, role-based access)
- **User management** (registration, authentication, permissions)
- **Sanctions checking** (with configurable parameters)
- **Audit logging** (with advanced filtering)
- **Email notifications** (welcome emails, password resets)
- **API authentication** (JWT and API Key methods)
- **Security validation** (self-deletion prevention, role enforcement)

Execute tests in recommended order in a Postman collection with environment variables for efficient testing, automated verification, and complete documentation of platform functionality.

````
