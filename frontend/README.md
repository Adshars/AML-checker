Frontend
========

Single-page application for AML (Anti-Money Laundering) sanctions screening system. Provides responsive user interface for entity screening, history tracking, user management, and analytics dashboard. Communicates with backend services through API Gateway using JWT authentication and role-based access control.

**Version:** 1.0.0  
**React:** 19.2.0  
**Build Tool:** Vite 7.2.4

## Table of Contents

- [Stack and Dependencies](#stack-and-dependencies)
- [Environment and Configuration](#environment-and-configuration)
- [Local Setup](#local-setup)
- [Docker Compose Setup](#docker-compose-setup)
- [Project Structure](#project-structure)
- [Routes and Features](#routes-and-features)
  - [Public Routes](#public-routes)
  - [Protected Routes](#protected-routes)
  - [Role-Based Routes](#role-based-routes)
- [API Integration](#api-integration-via-api-gateway)
  - [Authentication Endpoints](#authentication-endpoints)
  - [Sanctions & Core Service Endpoints](#sanctions--core-service-endpoints)
  - [User Management Endpoints](#user-management-endpoints-admin-only)
  - [Axios Interceptors](#axios-interceptors)
  - [Service Layer Architecture](#service-layer-architecture)
  - [API Response Handling](#api-response-handling)
- [Key Components and Services](#key-components-and-services)
  - [ScreeningPanel Component](#screeningpanel-component)
  - [ExtendedDetails Component](#extendeddetails-component)
  - [MainLayout Component](#mainlayout-component)
  - [AuthContext](#authcontext)
  - [authService](#authservice)
  - [api Service](#api-service)
  - [coreService](#coreservice)
- [How It Works](#how-it-works-high-level)
  - [Authentication Flow](#authentication-flow)
  - [Logout Flow](#logout-flow)
  - [Protected Route Access](#protected-route-access)
  - [API Request with Expired Token](#api-request-with-expired-token-silent-refresh)
  - [Entity Screening Flow](#entity-screening-flow)
  - [Token Persistence](#token-persistence)
- [Data Models](#data-models)
  - [User Object](#user-object)
  - [Entity Object](#entity-object-sanctions-check-result)
  - [AuditLog Object](#auditlog-object-history)
  - [Statistics Object](#statistics-object-dashboard)
- [Testing](#testing)
  - [Test Files](#test-files)
  - [Running Tests](#running-tests)
  - [Example Test Output](#example-test-output)
  - [Test Configuration](#test-configuration)
- [Development Notes](#development-notes)
  - [Environment Variables](#environment-variables)
  - [Hot Module Replacement](#hot-module-replacement-hmr)
  - [Build Output](#build-output)
  - [Browser Compatibility](#browser-compatibility)
- [Docker Deployment](#docker-deployment)
  - [Dockerfile Structure](#dockerfile-structure)
  - [nginx Configuration](#nginx-configuration)
  - [docker-compose.yml](#docker-composeyml)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## Stack and Dependencies

**Core Framework:**
- **React** 19.2.0 – Modern UI library with hooks and Context API
- **React DOM** 19.2.0 – React rendering for web
- **Vite** 7.2.4 – Fast build tool with HMR (Hot Module Replacement)

**Routing & State Management:**
- **React Router DOM** 7.12.0 – Client-side routing with protected routes
- **React Context API** – Global authentication state management

**UI Framework & Components:**
- **React Bootstrap** 2.10.10 + **Bootstrap** 5.3.8 – UI components and responsive grid
- **React Bootstrap Icons** 1.11.6 – Icon library
- **React Icons** 5.5.0 – Additional icon sets
- **React Toastify** 11.0.5 – Toast notifications for user feedback

**Data Visualization:**
- **Recharts** 3.7.0 – Charts for dashboard analytics

**HTTP Client:**
- **Axios** 1.13.2 – HTTP client with request/response interceptors

**Utilities:**
- **date-fns** 4.1.0 – Date formatting and manipulation

**Development & Testing:**
- **Vitest** 2.1.5 – Fast unit test framework
- **@testing-library/react** 16.0.1 – React component testing utilities
- **@testing-library/jest-dom** 6.1.5 – Custom DOM matchers
- **@testing-library/user-event** 14.5.2 – User interaction simulation
- **jsdom** 25.0.1 – DOM environment for tests
- **@vitest/ui** 2.1.5 – Visual test interface
- **ESLint** 9.x – Code linting with React plugins

## Environment and Configuration

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `VITE_API_URL` | API Gateway base URL | `http://localhost:8080` |

**Application Configuration:**
- Development server port: `5173`
- Production build output: `dist/` directory
- Authentication storage:
  - `token` – JWT access token (LocalStorage, 15 min expiry)
  - `refreshToken` – JWT refresh token (HttpOnly Cookie, 7 days expiry)
  - `user` – JSON-serialized user object (LocalStorage)

**Axios Configuration:**
- Automatic `Authorization: Bearer <token>` header injection on all requests
- Automatic redirect to `/login` on 401 responses
- Silent token refresh on 401 errors (with queue mechanism)

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   # .env
   VITE_API_URL=http://localhost:8080
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```
   Application available at `http://localhost:5173`

4. **Build for production:**
   ```bash
   npm run build
   ```
   Output in `dist/` directory

5. **Preview production build:**
   ```bash
   npm run preview
   ```

6. **Run tests:**
   ```bash
   npm test              # Watch mode
   npm run test:ui       # Visual UI
   npm run test:coverage # With coverage report
   ```

7. **Lint code:**
   ```bash
   npm run lint
   ```

## Docker Compose Setup

**From project root directory:**
```bash
docker compose up --build frontend
```

**Configuration:**
- Service accessible at `http://localhost:5173` (or mapped port from docker-compose)
- Production build served via nginx
- Environment variables configured in docker-compose.yml

---

## Project Structure
```
frontend/
├── src/
│   ├── __tests__/              # Test files (Vitest + React Testing Library)
│   │   ├── api.test.js               # API service tests (2 tests)
│   │   ├── authService.test.js       # Auth service tests (9 tests)
│   │   ├── AuthContext.test.jsx      # Auth context tests (5 tests)
│   │   └── ScreeningPanel.test.jsx   # Component tests (11 tests)
│   ├── assets/                 # Images, fonts, static resources
│   │   └── react.svg                 # React logo
│   ├── components/             # Reusable React components
│   │   ├── ExtendedDetails.jsx       # Entity details display with field sorting
│   │   ├── MainLayout.jsx            # Layout wrapper with navigation
│   │   └── ScreeningPanel.jsx        # Entity screening form with results display
│   ├── context/                # React Context providers
│   │   └── AuthContext.jsx           # Authentication state management
│   ├── hooks/                  # Custom React hooks (empty)
│   ├── pages/                  # Page components (routes)
│   │   ├── CheckPage.jsx             # Entity sanctions check interface
│   │   ├── DashboardPage.jsx         # Statistics and analytics dashboard
│   │   ├── DeveloperPage.jsx         # Developer tools and utilities
│   │   ├── HistoryPage.jsx           # Check history with filters
│   │   ├── LoginPage.jsx             # User authentication form
│   │   ├── ResetPasswordPage.jsx     # Password reset form
│   │   ├── SettingsPage.jsx          # User account settings
│   │   ├── SuperAdminPage.jsx        # Organization registration (superadmin)
│   │   └── UsersPage.jsx             # User management (admin)
│   ├── services/               # API service layer
│   │   ├── api.js                    # Axios instance + interceptors
│   │   ├── authService.js            # Authentication API calls
│   │   └── coreService.js            # Sanctions check API calls
│   ├── App.css                 # Root component styles
│   ├── App.jsx                 # Root component with routing
│   ├── index.css               # Global styles
│   ├── main.jsx                # Application entry point
│   └── setupTests.js           # Test environment setup
├── index.html              # HTML template
├── vite.config.js          # Vite configuration
├── vitest.config.js        # Vitest test configuration
└── package.json            # Dependencies and scripts
---

## Routes and Features

### Public Routes

**`/` (Root)**
- Redirects to `/dashboard` if authenticated
- Redirects to `/login` if not authenticated

**`/login` (LoginPage)**
- User authentication form
- Calls `POST /auth/login` via API Gateway
- Stores JWT tokens in localStorage
- Redirects based on role:
  - Superadmin → `/superadmin`
  - Others → `/dashboard`

**`/reset-password` (ResetPasswordPage)**
- Password reset form
- Validates token from email
- Calls `POST /auth/reset-password`
- Allows setting new password

### Protected Routes

All routes require JWT authentication. Redirected to `/login` if token missing/expired.

**`/dashboard` (DashboardPage)**
- Statistics and analytics dashboard
- Displays charts (Recharts) for:
  - Total checks
  - Sanction hits
  - PEP hits
- Calls `GET /sanctions/stats`

**`/check` (CheckPage with ScreeningPanel)**
- Entity sanctions screening interface
- Form validates input (trim whitespace, required field)
- Calls `GET /sanctions/check`
- Displays CLEAN/HIT results
- Entity details modal with ExtendedDetails component
- Loading spinner during API call

**`/history` (HistoryPage)**
- Search history with pagination and filters
- Filters by:
  - Date range
  - Entity name
  - Hit status
  - User ID
- Calls `GET /sanctions/history`
- Displays paginated results table

**`/settings` (SettingsPage)**
- User account settings
- Change password form
- Calls `POST /auth/change-password`

**`/developer` (DeveloperPage)**
- Developer tools and utilities
- API key management
- Documentation links

### Role-Based Routes

**`/superadmin` (SuperAdminPage)** - Superadmin Only
- Organization registration form
- Create new organizations with admin user
- Calls `POST /auth/register-organization`
- Displays API credentials after creation
- Includes logout button
- Non-superadmin users redirected based on role

**`/users` (UsersPage)** - Admin Only
- User management interface
- Lists all users in organization
- Create new user form
- Delete user functionality
- Calls `GET /users`, `POST /users`, `DELETE /users/:id`
- Non-admin users redirected to `/dashboard`

**Role-Based Access Control:**
- Enforced via AuthContext and ProtectedRoute guards in [App.jsx](src/App.jsx)
- Automatic role-based redirection

---

## API Integration (via API Gateway)

**Base URL:** `VITE_API_URL` (configured in .env; defaults to http://localhost:8080)

### Authentication Endpoints

| Method | Endpoint | Service File | Description | Request Payload | Response |
|--------|----------|--------------|-------------|-----------------|----------|
| POST | `/auth/login` | `authService.js` | User authentication; stores Access Token in localStorage, Refresh Token in Cookie | `{ email, password }` | `{ accessToken, user }` |
| POST | `/auth/logout` | `authService.js` | Invalidate refresh token; clears Cookie & localStorage | - | `{ message }` |
| POST | `/auth/change-password` | `api.js` | Change authenticated user's password | `{ currentPassword, newPassword }` | `{ message }` |
| POST | `/auth/forgot-password` | `api.js` | Request password reset email with token | `{ email }` | `{ message }` |
| POST | `/auth/reset-password` | `api.js` | Reset password using token from email | `{ userId, token, newPassword }` | `{ message }` |
| POST | `/auth/register-organization` | `api.js` | Register new organization with admin (superadmin only) | `{ orgName, email, password, firstName, lastName, ... }` | `{ organization, adminUser, apiKey, apiSecret }` |
| GET | `/auth/organization/keys` | `api.js` | Get organization's public API key | - | `{ apiKey }` |
| POST | `/auth/reset-secret` | `api.js` | Reset organization API secret (requires password) | `{ password }` | `{ apiKey, apiSecret }` |

### Sanctions & Core Service Endpoints

| Method | Endpoint | Service File | Description | Query/Request Parameters | Response |
|--------|----------|--------------|-------------|--------------------------|----------|
| GET | `/sanctions/check` | `coreService.js` | Check entity against sanctions/PEP lists | Query: `name` (required), `limit`, `fuzzy`, `schema`, `country` | `{ hits_count, data: [...], meta }` |
| GET | `/sanctions/history` | `api.js` | Get paginated audit history with filters | Query: `page`, `limit`, `search`, `hasHit`, `startDate`, `endDate`, `userId` | `{ data: [...], meta: { totalItems, totalPages, currentPage, itemsPerPage } }` |
| GET | `/sanctions/stats` | `api.js` | Get aggregated statistics for organization | - | `{ totalChecks, sanctionHits, pepHits, recentLogs }` |

### User Management Endpoints (Admin Only)

| Method | Endpoint | Service File | Description | Request Payload | Response |
|--------|----------|--------------|-------------|-----------------|----------|
| GET | `/users` | `api.js` | Get all users in organization | - | `{ data: [{ id, email, firstName, lastName, role, createdAt }] }` |
| POST | `/users` | `api.js` | Create new user in organization | `{ email, password, firstName, lastName }` | `{ message, user }` |
| DELETE | `/users/:id` | `api.js` | Delete user from organization | - | `{ message }` |

### Axios Interceptors

**Request Interceptor:**
- Automatically adds `Authorization: Bearer <token>` header from localStorage
- Token retrieved via `localStorage.getItem('token')`
- Applied to all API calls

**Response Interceptor (Silent Token Refresh):**
- Intercepts 401 Unauthorized responses (expired/invalid tokens)
- Implements token refresh queue mechanism:
  - First 401 triggers refresh token request
  - Subsequent 401s during refresh wait in queue
  - All queued requests retry after successful refresh
- On refresh failure:
  - Clears localStorage: `token`, `refreshToken`, `user`
  - Redirects to `/login` via `window.location.href`
- Skips redirect if error originates from `/auth/login` (prevents redirect loops)

### Service Layer Architecture

**[src/services/api.js](src/services/api.js) (Base API Module):**
- Axios instance with `baseURL` from `VITE_API_URL`
- Request/response interceptors for authentication
- Silent token refresh with queue mechanism
- Common API methods:
  - `getHistory()` – Paginated audit history
  - `getUsers()` – User list for organization
  - `createUser(data)` – Create new user
  - `deleteUser(id)` – Delete user
  - `changePassword(data)` – Change password
  - `getOrganizationKeys()` – Get API key
  - `resetOrganizationSecret(data)` – Reset API secret
  - `requestPasswordReset(email)` – Request reset email
  - `confirmPasswordReset(data)` – Confirm password reset
  - `getDashboardStats()` – Dashboard statistics
  - `registerOrganization(data)` – Register new organization

**[src/services/authService.js](src/services/authService.js) (Authentication Service):**
- `login(email, password)` – Authenticates user, saves tokens to localStorage
- `logout()` – Calls logout API, clears localStorage (graceful degradation if API fails)
- `getCurrentUser()` – Retrieves and parses user from localStorage

**[src/services/coreService.js](src/services/coreService.js) (Core Service):**
- `checkEntity(params)` – Sanctions check with query parameters
- Calls `GET /sanctions/check` with params: `name`, `limit`, `fuzzy`, `schema`, `country`

### API Response Handling

**Success Response Structure:**
```javascript
// Login
{
  accessToken: "jwt...",
  refreshToken: "jwt...",
  user: { id, email, role, firstName, lastName, organizationId }
}

// Sanctions Check (CLEAN)
{
  hits_count: 0,
  data: [],
  meta: { requestId, source }
}

// Sanctions Check (HIT)
{
  hits_count: 2,
  data: [
    {
      name, score, birthDate, country, datasets,
      isSanctioned, isPep, description, position, notes
    }
  ],
  meta: { requestId, source }
}

// History
{
  data: [...],
  meta: {
    totalItems: 150,
    totalPages: 8,
    currentPage: 1,
    itemsPerPage: 20
  }
}

// Stats
{
  totalChecks: 150,
  sanctionHits: 25,
  pepHits: 10,
  recentLogs: [...]
}
```

**Error Response Structure:**
```javascript
// Standard error (caught in components)
{ error: "Error message" }

// Network/timeout errors handled by axios interceptors
// 401 errors trigger automatic token refresh or redirect to /login
```

---

## Key Components and Services

### ScreeningPanel Component

**File:** [src/components/ScreeningPanel.jsx](src/components/ScreeningPanel.jsx)

**Purpose:** Entity screening form with validation and results display

**State Management:**
- `name` – Input field value
- `loading` – API call in progress
- `error` – Validation/API error message
- `results` – CLEAN/HIT status with entity array
- `showModal` – Entity details modal visibility
- `selectedEntity` – Clicked entity for modal

**Form Submission Flow:**
1. Validates empty input (trim whitespace)
2. Calls `coreService.checkEntity({ name: trimmedName, fuzzy: true, limit: 10 })`
3. Normalizes API response (handles `data`, `results`, `hits` fields)
4. Updates results state

**Results Display:**
- CLEAN status: Success Alert component
- HIT status: Danger Alert with entity ListGroup
- Each entity clickable to open Modal with ExtendedDetails

**Error Handling:**
- Displays validation errors: "Name field is required"
- Displays API errors from `response.data.message` or `error.message`
- Shows loading Spinner during API call

### ExtendedDetails Component

**File:** [src/components/ExtendedDetails.jsx](src/components/ExtendedDetails.jsx)

**Purpose:** Display entity details with logical field ordering

**Features:**
- **Priority-based field sorting** using `PRIORITY_KEYS` array:
  1. Basic Identity: name, firstName, lastName, gender, title
  2. Birth & Death: birthDate, birthPlace, deathDate
  3. Legal Status: nationality, citizenship, country
  4. Occupation: position, education, religion, political
  5. Contact Data: address, email, phone, taxNumber
  6. Other: alias, weakAlias, notes
- Formats field names with proper capitalization
- Handles arrays (joins with commas)
- Displays empty state for missing data

### MainLayout Component

**File:** [src/components/MainLayout.jsx](src/components/MainLayout.jsx)

**Purpose:** Layout wrapper with navigation and role-based menu

**Features:**
- Navigation bar with logo and links
- Role-based menu items:
  - Dashboard (all roles)
  - Check (all roles)
  - History (all roles)
  - Users (admin/superadmin only)
  - Settings (all roles)
  - Developer (all roles)
- User dropdown menu:
  - Display user name and role
  - Logout button
- Responsive design with Bootstrap

### AuthContext

**File:** [src/context/AuthContext.jsx](src/context/AuthContext.jsx)

**Purpose:** Global authentication state provider using React Context API

**State:**
- `user` – Logged in user object or null
- `loading` – Initialization in progress

**Initialization:**
- On mount, reads localStorage via `authService.getCurrentUser()`
- Updates user state
- Sets `loading=false`

**Methods:**
- `login(email, password)` – Calls `authService.login()`, updates user state
- `logout()` – Calls `authService.logout()`, clears user state, redirects to `/login`

**Usage:**
- Wraps App component
- Consumed by pages via `useContext(AuthContext)`

### authService

**File:** [src/services/authService.js](src/services/authService.js)

**Purpose:** Authentication utility functions with localStorage persistence

**Methods:**

**`login(email, password)`**
- Calls `api.post('/auth/login', { email, password })`
- If `response.data.accessToken` exists:
  - Saves `token`, `user` to localStorage
  - (Refresh token handled automatically via HttpOnly Cookie)
- Returns `response.data`

**`logout()`**
- Calls `api.post('/auth/logout')` (Cookie sent automatically)
- Always clears localStorage in finally block (graceful degradation)
- Clears: `token`, `user`

**`getCurrentUser()`**
- Reads `user` from localStorage
- Parses JSON
- Returns user object or null on error/empty

### api Service

**File:** [src/services/api.js](src/services/api.js)

**Purpose:** Axios instance with base URL and interceptors

**Configuration:**
- Base URL from `VITE_API_URL` environment variable
- Request interceptor: Adds `Authorization: Bearer <token>` header
- Response interceptor: Handles 401 errors with silent refresh and redirect

**Features:**
- Silent token refresh with queue mechanism
- Automatic retry of failed requests after refresh
- Graceful fallback to login on refresh failure

### coreService

**File:** [src/services/coreService.js](src/services/coreService.js)

**Purpose:** Sanctions check API calls

**Methods:**

**`checkEntity({ name, fuzzy, limit })`**
- Calls `api.get('/sanctions/check', { params })`
- Returns `response.data` with CLEAN/HIT status and entity array

---

## How It Works (High Level)

### Authentication Flow
- **Logout Flow**: User clicks logout → `authService.logout()` calls `POST /auth/logout` (invalidates refresh token on server) → clears localStorage (token, refreshToken, user) even on API failure → updates AuthContext state → redirects to `/login`.
- **Protected Route Access**: User navigates to protected route → AuthContext checks localStorage for user/token → if missing, redirects to `/login` → if present, renders requested page component; ProtectedRoute checks `requiredRole` and redirects if role mismatch.
- **API Request Flow**: Component calls API service method → axios interceptor adds `Authorization: Bearer <token>` header from localStorage → request sent to API Gateway → response returned → if 401, interceptor clears localStorage and redirects to `/login`.
- **Entity Screening Flow**: User enters entity name in ScreeningPanel → form validates (trim whitespace, required field) → calls `coreService.checkEntity()` → `GET /sanctions/check` via API Gateway → receives response with CLEAN/HIT status → normalizes data (handles different API response structures: `data`, `results`, `hits` fields) → displays results (Alert component for CLEAN, ListGroup for HIT entities) → user clicks entity to open details modal.
- **History Viewing Flow**: User navigates to `/history` → HistoryPage mounts → calls `api.get('/sanctions/history')` with pagination/filters → receives paginated data with metadata → displays table with filters (search, date range, hit status) → user applies filters → updates query parameters → refetches data.
- **Dashboard Flow**: User navigates to `/dashboard` → DashboardPage mounts → calls `api.get('/sanctions/stats')` → receives aggregated statistics (totalChecks, sanctionHits, pepHits, recentLogs) → renders charts (Recharts) and statistics cards.
- **SuperAdmin Flow**: SuperAdmin logs in → redirected to `/superadmin` → fills organization registration form → calls `registerOrganization()` → `POST /auth/register-organization` → receives organization data with API credentials → displays success message with copyable credentials → can logout via button in header.
- **Token Persistence**: On page load/refresh → AuthContext useEffect reads localStorage → calls `authService.getCurrentUser()` → parses user JSON → updates state → user remains logged in across sessions.

Testing
-------

Unit and integration tests verify authentication flows, API interactions, state management, form validation, and UI component behavior. Tests use Vitest + React Testing Library with jsdom environment to simulate browser DOM.

Test Files
- `tests/api.test.js` – API service (2 tests).
	- **GET requests** (1 test): Mocks axios and verifies GET call with correct URL.
	- **POST requests** (1 test): Mocks axios and verifies POST call with payload.
	- Mocks: Entire `api` module to prevent axios initialization issues.
- `tests/authService.test.js` – Authentication service (9 tests).
	- **login()** (3 tests): Successful login saves tokens to localStorage; login without token skips localStorage; login failure throws error.
	- **logout()** (3 tests): Calls logout API and clears localStorage; clears localStorage even if API fails (graceful degradation); works when refreshToken missing.
	- **getCurrentUser()** (3 tests): Returns parsed user from localStorage; returns null when localStorage empty; handles JSON parse errors gracefully.
	- Mocks: `api.post`, `localStorage` (getItem, setItem, removeItem).
- `tests/AuthContext.test.jsx` – Authentication context (5 tests).
	- **Initialization** (2 tests): Loads user from localStorage on mount via `getCurrentUser()`; initializes with null when localStorage empty.
	- **Login** (1 test): Updates user state when login called.
	- **Logout** (1 test): Clears user state and redirects to `/login` via `window.location.href`.
	- **Loading state** (1 test): Shows loading state during initialization; renders children after loading completes.
	- Mocks: `authService` (getCurrentUser, login, logout).
- `tests/ScreeningPanel.test.jsx` – Entity screening component (11 tests).
	- **Form Rendering** (1 test): Renders form with input field and submit button.
	- **Validation** (2 tests): Shows validation error for empty name (bypasses HTML5 validation to test JS logic); trims whitespace and rejects empty input after trim.
	- **API Interaction** (1 test): Calls `coreService.checkEntity` with trimmed name parameter.
	- **Loading State** (1 test): Shows loading spinner during API call.
	- **Results Display** (2 tests): Displays CLEAN result with success Alert; displays HIT result with danger Alert and entity list.
	- **Data Normalization** (1 test): Normalizes different API response structures (`data`, `results`, `hits` fields).
	- **Error Handling** (2 tests): Displays error message from `response.data.message`; handles error without response.data (fallback to `error.message`).
	- **Modal Interaction** (1 test): Opens modal when entity clicked; displays entity details in modal.
	- Mocks: `coreService.checkEntity`.

Running Tests

ScreeningPanel Component (components/ScreeningPanel.jsx)
- Entity screening form with validation (trim whitespace, required field).
- State management: `name` (input), `loading` (API call in progress), `error` (validation/API error), `results` (CLEAN/HIT with entity array), `showModal` (entity details), `selectedEntity` (clicked entity).
- Form submission: validates empty input → calls `coreService.checkEntity({ name: trimmedName, fuzzy: true, limit: 10 })` → normalizes API response (handles `data`, `results`, `hits` fields) → updates results state.
- Results display: CLEAN status shows success Alert; HIT status shows danger Alert with ListGroup of entities; each entity clickable to open Modal with full details.
- Error handling: displays validation errors (Name field is required); displays API errors from `response.data.message` or `error.message`; shows loading Spinner during API call.

AuthContext (context/AuthContext.jsx)
- Global authentication state provider using React Context API.
- State: `user` (logged in user object or null), `loading` (initialization in progress).
- Initialization: on mount, reads localStorage via `authService.getCurrentUser()` → updates user state → sets loading=false.
- Methods: `login(email, password)` calls `authService.login()` and updates user state; `logout()` calls `authService.logout()`, clears user state, redirects to `/login` via `window.location.href`.
- Wraps App component; consumed by pages via `useContext(AuthContext)`.

authService (services/authService.js)
- Authentication utility functions with localStorage persistence.
- `login(email, password)`: calls `api.post('/auth/login', { email, password })` → if `response.data.accessToken` exists, saves `token`, `refreshToken`, `user` to localStorage → returns response.data.
- `logout()`: reads refreshToken from localStorage → tries `api.post('/auth/logout', { refreshToken })` → always clears localStorage (token, refreshToken, user) in finally block even if API fails → graceful degradation for network errors.
- `getCurrentUser()`: reads `user` from localStorage → parses JSON → returns user object or null on error/empty.

api Service (services/api.js)
- Axios instance with base URL from `VITE_API_URL` environment variable.
- **Request Interceptor**: reads `token` from localStorage → if exists, adds `Authorization: Bearer <token>` header to config → returns config.
- **Response Interceptor**: on 401 error, checks if request URL is not `/auth/login` → clears localStorage (token, refreshToken, user) → redirects to `/login` via `window.location.href` → rejects promise; on success, returns response unchanged.
- Exports axios instance for use in authService and coreService.

coreService (services/coreService.js)
- Sanctions check API calls via API Gateway.
- `checkEntity({ name, fuzzy, limit })`: calls `api.get('/sanctions/check', { params })` → returns response.data with CLEAN/HIT status and entity array.

Data Models
- **User** (localStorage + AuthContext): `{ id, email, firstName, lastName, role, organizationId }` (JWT payload stored as JSON string).
- **Entity** (ScreeningPanel results): `{ id, name, score, birthDate, country, datasets, schema, isSanctioned, isPep, description, position, notes }` (from Core Service response).
- **AuditLog** (History page): `{ id, organizationId, userId, searchQuery, hasHit, hitsCount, entityName, entityScore, entityBirthDate, entityCountries, entityDatasets, isSanctioned, isPep, createdAt }` (from Core Service /history endpoint).
- **Statistics** (Dashboard page): `{ totalChecks, sanctionHits, pepHits, recentLogs }` (from Core Service /stats endpoint).
✓ src/__tests__/AuthContext.test.jsx (5)
  ✓ AuthContext (5)
    ✓ should initialize with user from localStorage
    ✓ should initialize with no user when localStorage is empty
    ✓ should update user state on login
    ✓ should clear user state on logout and redirect
    ✓ should show loading state during initialization

✓ src/__tests__/ScreeningPanel.test.jsx (11)
  ✓ ScreeningPanel (11)
    ✓ should render form with input and submit button
    ✓ should show validation error for empty name
    ✓ should trim whitespace and reject empty input
    ✓ should call coreService.checkEntity with trimmed name
    ✓ should show loading spinner during API call
    ✓ should display CLEAN result with success alert
    ✓ should display HIT result with danger alert and list
    ✓ should normalize API response with different structures
    ✓ should display error message on API failure
    ✓ should handle API error without response data
    ✓ should open modal when entity is clicked

Test Files  4 passed (4)
     Tests  27 passed (27)
  Duration  3.03s
```

Key Components and Services

ScreeningPanel Component (components/ScreeningPanel.jsx)
- Entity screening form with validation (trim whitespace, required field).
- State management: `name` (input), `loading` (API call in progress), `error` (validation/API error), `results` (CLEAN/HIT with entity array), `showModal` (entity details), `selectedEntity` (clicked entity).
- Form submission: validates empty input → calls `coreService.checkEntity({ name: trimmedName, fuzzy: true, limit: 10 })` → normalizes API response (handles `data`, `results`, `hits` fields) → updates results state.
- Results display: CLEAN status shows success Alert; HIT status shows danger Alert with ListGroup of entities; each entity clickable to open Modal with full details.
- Error handling: displays validation errors (Name field is required); displays API errors from `response.data.message` or `error.message`; shows loading Spinner during API call.
- Note: Uses GET method with query parameters via coreService.checkEntity().

AuthContext (context/AuthContext.jsx)
- Global authentication state provider using React Context API.
- State: `user` (logged in user object or null), `loading` (initialization in progress).
- Initialization: on mount, reads localStorage via `authService.getCurrentUser()` → updates user state → sets loading=false.
- Methods: `login(email, password)` calls `authService.login()` and updates user state; `logout()` calls `authService.logout()`, clears user state, redirects to `/login` via `window.location.href`.
- Wraps App component; consumed by pages via `useContext(AuthContext)`.

authService (services/authService.js)
- Authentication utility functions with localStorage persistence.
- `login(email, password)`: calls `api.post('/auth/login', { email, password })` → if `response.data.accessToken` exists, saves `token`, `refreshToken`, `user` to localStorage → returns response.data.
- `logout()`: reads refreshToken from localStorage → tries `api.post('/auth/logout', { refreshToken })` → always clears localStorage (token, refreshToken, user) in finally block even if API fails → graceful degradation for network errors.
- `getCurrentUser()`: reads `user` from localStorage → parses JSON → returns user object or null on error/empty.

api Service (services/api.js)
- Axios instance with base URL from `VITE_API_URL` environment variable.
- **Request Interceptor**: reads `token` from localStorage → if exists, adds `Authorization: Bearer <token>` header to config → returns config.
- **Response Interceptor**: on 401 error, checks if request URL is not `/auth/login` → clears localStorage (token, refreshToken, user) → redirects to `/login` via `window.location.href` → rejects promise; on success, returns response unchanged.
- Exports axios instance for use in authService and coreService.

coreService (services/coreService.js)
- Sanctions check API calls via API Gateway.
- `checkEntity({ name, fuzzy, limit })`: calls `api.post('/sanctions/check', { name, fuzzy, limit })` → returns response.data with CLEAN/HIT status and entity array.

Data Models
- **User** (localStorage + AuthContext): `{ id, email, firstName, lastName, role, organizationId }` (JWT payload stored as JSON string).
- **Entity** (ScreeningPanel results): `{ id, name, score, birthDate, country, datasets, schema, isSanctioned, isPep, description, position, notes }` (from Core Service response).
- **AuditLog** (History page): `{ id, organizationId, userId, searchQuery, hasHit, hitsCount, entityName, entityScore, entityBirthDate, entityCountries, entityDatasets, isSanctioned, isPep, createdAt }` (from Core Service /history endpoint).
- **Statistics** (Dashboard page): `{ totalChecks, sanctionHits, pepHits, recentLogs }` (from Core Service /stats endpoint).
