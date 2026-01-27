Frontend
========

Single-page application for AML (Anti-Money Laundering) sanctions screening system. Provides responsive user interface for entity screening, history tracking, user management, and analytics dashboard. Communicates with backend services through API Gateway using JWT authentication and role-based access control.

Stack and Dependencies
- React 19.2.0, Vite 7.2.4 (build tool), ES6+ JavaScript
- React Router DOM 7.12.0 (client-side routing with protected routes)
- React Bootstrap 2.10.10 + Bootstrap 5.3.8 (UI components and styling)
- Recharts 3.7.0 (data visualization for dashboard charts)
- React Toastify 11.0.5 (toast notifications for user feedback)
- Axios 1.13.2 (HTTP client with request/response interceptors)
- React Context API (global authentication state management)
- Vitest 2.1.5 + @testing-library/react 16.0.1 (testing framework with React Testing Library)
- @testing-library/jest-dom 6.1.5 + @testing-library/user-event 14.5.2 (DOM matchers and user interactions)
- jsdom 25.0.1 + @vitest/ui 2.1.5 (DOM environment and visual test interface)
- ESLint 9.x (code linting with React plugin)

Environment and Configuration
- `VITE_API_URL` – API Gateway base URL; defaults to `http://localhost:8080` in development.
- Application runs on port 5173 in development; production build outputs to `dist/` directory.
- Authentication tokens stored in browser localStorage: `token` (JWT access token), `refreshToken` (JWT refresh token), `user` (JSON-serialized user object).
- Axios interceptors automatically inject `Authorization: Bearer <token>` header on all requests; redirect to `/login` on 401 responses.

Local Setup
1) `npm install`
2) Create `.env` file with `VITE_API_URL=http://localhost:8080` (or API Gateway address)
3) `npm run dev` (starts Vite development server on http://localhost:5173)
4) `npm run build` (production build to dist/)
5) `npm run preview` (preview production build)
6) `npm test` (run tests in watch mode)

Docker Compose Setup
- From project root directory: `docker compose up --build frontend`
- Service accessible at http://localhost:5173 (or mapped port from docker-compose).
- Build output served via nginx in production container.

Project Structure
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
```

Routes and Features
- `/` – redirects to `/login` if not authenticated; to `/check` if authenticated.
- `/login` – user authentication form (LoginPage); calls `POST /auth/login` via API Gateway; stores JWT tokens in localStorage; redirects to `/check` on success.
- `/check` – entity sanctions screening interface (CheckPage with ScreeningPanel); form validates input (trim whitespace, required field); calls `POST /sanctions/check`; displays CLEAN/HIT results with entity details modal; shows loading spinner during API call.
- `/history` – search history with pagination and filters (HistoryPage); filters by date range, entity name, hit status, user ID; calls `GET /sanctions/history`; displays paginated results table.
- `/dashboard` – statistics and analytics dashboard (DashboardPage); displays charts (Recharts) for total checks, sanction hits, PEP hits; calls `GET /sanctions/stats`.
- `/users` – user management interface (UsersPage, admin role only); lists all users; create new user form; delete user functionality; calls `GET /users`, `POST /users`, `DELETE /users/:id`.
- `/settings` – user account settings (SettingsPage); change password form; calls `POST /auth/change-password`.

Protected Routes
- All routes except `/login` require JWT authentication; redirected to `/login` if token missing/expired.
- `/users` route restricted to admin role; non-admin users redirected to `/check`.
- Role-based access enforced via AuthContext and route guards in App.jsx.

API Integration (via API Gateway)
- Base URL: `VITE_API_URL` (configured in .env; defaults to http://localhost:8080).
- **Authentication Service**:
	- `POST /auth/login` – user login; returns `{ accessToken, refreshToken, user }`.
	- `POST /auth/logout` – user logout; invalidates refresh token.
	- `POST /auth/change-password` – change user password; requires JWT authentication.
- **Core Sanctions Service**:
	- `POST /sanctions/check` – check entity against sanctions; requires `name` parameter; returns `{ result, data }` with CLEAN/HIT status and entity array.
	- `GET /sanctions/history` – get paginated check history; supports filters (search, hasHit, startDate, endDate, userId, page, limit).
	- `GET /sanctions/stats` – get aggregated statistics; returns `{ totalChecks, sanctionHits, pepHits, recentLogs }`.
- **User Management Service**:
	- `GET /users` – get all users (admin only).
	- `POST /users` – create new user (admin only); requires `{ email, password, role, firstName, lastName }`.
	- `DELETE /users/:id` – delete user (admin only).
- **Request Interceptor**: Automatically adds `Authorization: Bearer <token>` header from localStorage to all requests.
- **Response Interceptor**: Intercepts 401 responses; clears localStorage (token, refreshToken, user); redirects to `/login`; skips redirect if already on `/auth/login` route.

How It Works (High Level)
- **Authentication Flow**: User submits login form → `authService.login()` calls `POST /auth/login` via API Gateway → receives JWT tokens and user object → stores in localStorage → updates AuthContext state → redirects to `/check`.
- **Logout Flow**: User clicks logout → `authService.logout()` calls `POST /auth/logout` (invalidates refresh token on server) → clears localStorage (token, refreshToken, user) even on API failure → updates AuthContext state → redirects to `/login`.
- **Protected Route Access**: User navigates to protected route → AuthContext checks localStorage for user/token → if missing, redirects to `/login` → if present, renders requested page component.
- **API Request Flow**: Component calls API service method → axios interceptor adds `Authorization: Bearer <token>` header from localStorage → request sent to API Gateway → response returned → if 401, interceptor clears localStorage and redirects to `/login`.
- **Entity Screening Flow**: User enters entity name in ScreeningPanel → form validates (trim whitespace, required field) → calls `coreService.checkEntity()` → `POST /sanctions/check` via API Gateway → receives response with CLEAN/HIT status → normalizes data (handles different API response structures: `data`, `results`, `hits` fields) → displays results (Alert component for CLEAN, ListGroup for HIT entities) → user clicks entity to open details modal.
- **History Viewing Flow**: User navigates to `/history` → HistoryPage mounts → calls `api.get('/sanctions/history')` with pagination/filters → receives paginated data with metadata → displays table with filters (search, date range, hit status) → user applies filters → updates query parameters → refetches data.
- **Dashboard Flow**: User navigates to `/dashboard` → DashboardPage mounts → calls `api.get('/sanctions/stats')` → receives aggregated statistics (totalChecks, sanctionHits, pepHits, recentLogs) → renders charts (Recharts) and statistics cards.
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
	- **Validation** (2 tests): Shows validation error for empty name; trims whitespace and rejects empty input after trim.
	- **API Interaction** (1 test): Calls `coreService.checkEntity` with trimmed name parameter.
	- **Loading State** (1 test): Shows loading spinner during API call.
	- **Results Display** (2 tests): Displays CLEAN result with success Alert; displays HIT result with danger Alert and entity list.
	- **Data Normalization** (1 test): Normalizes different API response structures (`data`, `results`, `hits` fields).
Key Components and Services

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
- `checkEntity({ name, fuzzy, limit })`: calls `api.post('/sanctions/check', { name, fuzzy, limit })` → returns response.data with CLEAN/HIT status and entity array.

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
Test Files  4 passed (4)
     Tests  27 passed (27)
  Duration  3.36s
```

Key Components and Services

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
- `checkEntity({ name, fuzzy, limit })`: calls `api.post('/sanctions/check', { name, fuzzy, limit })` → returns response.data with CLEAN/HIT status and entity array.

Data Models
- **User** (localStorage + AuthContext): `{ id, email, firstName, lastName, role, organizationId }` (JWT payload stored as JSON string).
- **Entity** (ScreeningPanel results): `{ id, name, score, birthDate, country, datasets, schema, isSanctioned, isPep, description, position, notes }` (from Core Service response).
- **AuditLog** (History page): `{ id, organizationId, userId, searchQuery, hasHit, hitsCount, entityName, entityScore, entityBirthDate, entityCountries, entityDatasets, isSanctioned, isPep, createdAt }` (from Core Service /history endpoint).
- **Statistics** (Dashboard page): `{ totalChecks, sanctionHits, pepHits, recentLogs }` (from Core Service /stats endpoint).
