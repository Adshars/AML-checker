Frontend
========

Single-page application for the AML sanctions screening system. Provides entity screening, history browsing (with CSV export and per-check PDF confirmation), user management, and analytics dashboard. Communicates with backend services via the API Gateway using JWT access tokens and refresh cookies.

**Version:** 1.0.0  
**React:** 19.2.0  
**Build Tool:** Vite 7.2.4

## Table of Contents

- [Stack](#stack)
- [Environment](#environment)
- [Local Setup](#local-setup)
- [Docker Setup](#docker-setup)
- [Project Structure](#project-structure)
- [Routes](#routes)
- [Authentication and Session](#authentication-and-session)
- [API Integration](#api-integration)
- [History export & PDF confirmation](#history-export--pdf-confirmation)
- [Components and Hooks](#components-and-hooks)
- [Testing](#testing)

---

## Stack

- **React 19.2.0** with hooks and Context API
- **React Router DOM 7.12.0** for routing and guarded routes
- **React Bootstrap 2.10.10 + Bootstrap 5.3.8** for UI, with a custom SCSS theme (`src/theme/`, navy `#1B2A4A` + teal `#0F9D82`, IBM Plex Sans) — built via **sass 1.101.0**
- **@tabler/icons-react 3.45.0** for iconography (replaced `react-bootstrap-icons`/`react-icons` during the Phase 2 redesign)
- **pdfmake 0.2.23** for generating the History "confirmation PDF" export client-side (no backend endpoint involved)
- **Axios 1.13.2** with interceptors and refresh queue
- **Recharts 3.7.0** for dashboard charts
- **date-fns 4.1.0** for date formatting
- **React Toastify 11.0.5** for toast notifications
- **Vitest 2.1.5** + Testing Library for tests

## Environment

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | API Gateway base URL | `http://localhost:8080` |

Notes:
- Dev server runs on `5173` and loads Bootstrap in [src/main.jsx](src/main.jsx).
- Auth storage uses localStorage keys: `token` and `user`. Refresh tokens are **HttpOnly cookies**.

## Local Setup

```bash
npm install
npm run dev
```

Other scripts:
```bash
npm run build
npm run preview
npm run lint
npm test
npm run test:ui
npm run test:coverage
```

## Docker Setup

```bash
docker compose up --build frontend
```

The Dockerfile runs the Vite dev server on port `5173` (not a production build). See [Dockerfile](Dockerfile).

## Project Structure

```
frontend/
├── src/
│   ├── __tests__/               # Vitest tests
│   ├── assets/                  # Static assets
│   ├── components/              # Reusable UI (ScreeningPanel, MainLayout, ExtendedDetails)
│   ├── constants/               # Sanctions constants
│   ├── context/                 # AuthContext
│   ├── hooks/                   # useSanctionsCheck, useUsers
│   ├── pages/                   # Routes (Login, Dashboard, Check, History, Users, etc.)
│   ├── services/                # api, authService, coreService
│   ├── theme/                    # Custom Bootstrap SCSS theme (_variables.scss, index.scss)
│   ├── utils/                    # sanctionsMapper, extendedDetailsMapper, historyLogFormatters, pdfConfirmation
│   ├── App.jsx                  # Router and route guards
│   ├── main.jsx                 # App entry, AuthProvider
│   └── setupTests.js            # Test setup
├── vite.config.js
├── vitest.config.js
└── package.json
```

## Routes

Public:
- `/login` (login + forgot password modal)
- `/reset-password` (token + user id via query params)

Protected:
- `/dashboard` (stats + charts)
- `/check` (sanctions screening)
- `/history` (audit logs with filters and details)
- `/users` (admin only user management)
- `/settings` (change password)
- `/developer` (API keys / secret reset)

Role-based:
- `/superadmin` (superadmin-only org registration)

Root `/` redirects to `/dashboard`.

## Authentication and Session

- Login stores `token` and `user` in localStorage; refresh token is managed by HttpOnly cookie.
- The `user` object includes `organizationName` (added by auth-service at login) alongside `id`, `email`, `role`, `firstName`, `lastName`, `organizationId`. It is consumed via `useContext(AuthContext)` — e.g. by the History page's PDF confirmation export.
- On app startup, [AuthContext](src/context/AuthContext.jsx) checks the cached user and calls `silentRefresh`. If the stored JWT is still valid (expiry > 60 s from now), the API call is skipped and the cached token is reused; otherwise `POST /auth/refresh` is called to obtain a fresh access token.
- [api.js](src/services/api.js) attaches `Authorization: Bearer <token>` to every request, intercepts 401 responses, queues concurrent in-flight requests, performs a single refresh, then replays the queued requests with the new token.
- Refresh failure clears localStorage and redirects to `/login`.

## API Integration

Base URL is `VITE_API_URL` with `withCredentials: true` for cookies.

Authentication:
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh` (silent refresh)
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password`
- `POST /auth/register-organization`
- `GET /auth/organization/keys`
- `POST /auth/reset-secret`

Sanctions and audit:
- `GET /sanctions/check` (query params: `name`, `limit`, `fuzzy`, `schema`, `country`)
- `GET /sanctions/history` (filters: `page`, `limit`, `search`, `hasHit`, `startDate`, `endDate`)
- `GET /sanctions/history/export` (same filters minus `page`/`limit`; downloads a CSV file — see [History export & PDF confirmation](#history-export--pdf-confirmation))
- `GET /sanctions/stats`

Users:
- `GET /users`
- `POST /users`
- `DELETE /users/:id`

## History export & PDF confirmation

The History view ([HistoryPage.jsx](src/pages/HistoryPage.jsx)) has two export actions:

- **Export CSV** (header button) — calls `exportHistory()` in [api.js](src/services/api.js) with the current filters (no pagination), reads the filename from the `Content-Disposition` response header (the gateway must expose it via CORS), and triggers a browser download via a Blob URL.
- **Download PDF** (Log Details modal footer, next to "Close") — generated entirely client-side by [pdfConfirmation.js](src/utils/pdfConfirmation.js) (`pdfmake`) from the already-loaded `selectedLog` object; no network request. Produces a branded, paginated confirmation document (meta data, result badge, entity data, and the same "Dane szczegółowe" table as `ExtendedDetails.jsx`) matching the visual style from Phase 2. The reference number is derived from the log's `id` + `createdAt` (no backend changes); the organization name comes from `user.organizationName` (see [Authentication and Session](#authentication-and-session)).
- [extendedDetailsMapper.js](src/utils/extendedDetailsMapper.js) and [historyLogFormatters.js](src/utils/historyLogFormatters.js) hold the filtering/sorting/formatting logic shared between [ExtendedDetails.jsx](src/components/ExtendedDetails.jsx), `HistoryPage.jsx`, and the PDF export, so the three stay in sync.

## Components and Hooks

- [ScreeningPanel](src/components/ScreeningPanel.jsx) uses [useSanctionsCheck](src/hooks/useSanctionsCheck.js) and normalizes API responses (`data`, `results`, `hits`).
- [ExtendedDetails](src/components/ExtendedDetails.jsx) renders entity details from `properties` and `hitDetails` with a priority order (logic shared with the PDF export via [extendedDetailsMapper.js](src/utils/extendedDetailsMapper.js)).
- [MainLayout](src/components/MainLayout.jsx) provides navigation, role-aware menu entries, and the collapsible sidebar (hidden behind a hamburger on narrow viewports).
- [useUsers](src/hooks/useUsers.js) handles fetch/create/delete flows with user-facing errors.
- [sanctionsMapper](src/utils/sanctionsMapper.js) maps raw hits (from `/sanctions/check`) to a consistent domain object.
- [historyLogFormatters.js](src/utils/historyLogFormatters.js) — `getLatinName`, `formatDatasets`, `getUserLabel`; shared between `HistoryPage.jsx` and the PDF export.
- [pdfConfirmation.js](src/utils/pdfConfirmation.js) — builds and downloads the History "confirmation PDF" (see [History export & PDF confirmation](#history-export--pdf-confirmation)).

## Testing

Vitest tests are in [src/__tests__](src/__tests__), one file per page/component plus shared utilities. Notable files:
- [api.test.js](src/__tests__/api.test.js) — `getHistory`/`exportHistory` URL and filter construction
- [authService.test.js](src/__tests__/authService.test.js)
- [AuthContext.test.jsx](src/__tests__/AuthContext.test.jsx)
- [HistoryPage.test.jsx](src/__tests__/HistoryPage.test.jsx) — table, filters, pagination, CSV export, PDF download
- [ExtendedDetails.test.jsx](src/__tests__/ExtendedDetails.test.jsx)
- [extendedDetailsMapper.test.js](src/__tests__/extendedDetailsMapper.test.js)
- [historyLogFormatters.test.js](src/__tests__/historyLogFormatters.test.js)
- [pdfConfirmation.test.js](src/__tests__/pdfConfirmation.test.js) — all 4 result variants + multi-page case (asserts on the `pdfmake` document definition, does not render an actual PDF)
- [ScreeningPanel.test.jsx](src/__tests__/ScreeningPanel.test.jsx)
- [sanctionsMapper.test.js](src/__tests__/sanctionsMapper.test.js)
- [useSanctionsCheck.test.js](src/__tests__/useSanctionsCheck.test.js)
- [useUsers.test.js](src/__tests__/useUsers.test.js)
- Plus one test file per remaining page: `DashboardPage`, `DeveloperPage`, `LoginPage`, `MainLayout`, `ResetPasswordPage`, `SettingsPage`, `SuperAdminPage`, `UsersPage`.
