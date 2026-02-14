Frontend
========

Single-page application for the AML sanctions screening system. Provides entity screening, history browsing, user management, and analytics dashboard. Communicates with backend services via the API Gateway using JWT access tokens and refresh cookies.

**Version:** 0.0.0  
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
- [Components and Hooks](#components-and-hooks)
- [Testing](#testing)

---

## Stack

- **React 19.2.0** with hooks and Context API
- **React Router DOM 7.12.0** for routing and guarded routes
- **React Bootstrap 2.10.10 + Bootstrap 5.3.8** for UI
- **Axios 1.13.2** with interceptors and refresh queue
- **Recharts 3.7.0** for dashboard charts
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
│   ├── utils/                   # sanctionsMapper
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
- On app startup, [AuthContext](src/context/AuthContext.jsx) checks cached user and performs a silent refresh.
- [api.js](src/services/api.js) intercepts 401s and performs refresh with a queue to replay failed requests.
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
- `GET /sanctions/stats`

Users:
- `GET /users`
- `POST /users`
- `DELETE /users/:id`

## Components and Hooks

- [ScreeningPanel](src/components/ScreeningPanel.jsx) uses [useSanctionsCheck](src/hooks/useSanctionsCheck.js) and normalizes API responses (`data`, `results`, `hits`).
- [ExtendedDetails](src/components/ExtendedDetails.jsx) renders entity details from `properties` and `hitDetails` with a priority order.
- [MainLayout](src/components/MainLayout.jsx) provides navigation and role-aware menu entries.
- [useUsers](src/hooks/useUsers.js) handles fetch/create/delete flows with user-facing errors.
- [sanctionsMapper](src/utils/sanctionsMapper.js) maps raw hits to a consistent domain object.

## Testing

Vitest tests are in [src/__tests__](src/__tests__). Key files:
- [api.test.js](src/__tests__/api.test.js)
- [authService.test.js](src/__tests__/authService.test.js)
- [AuthContext.test.jsx](src/__tests__/AuthContext.test.jsx)
- [ScreeningPanel.test.jsx](src/__tests__/ScreeningPanel.test.jsx)
- [sanctionsMapper.test.js](src/__tests__/sanctionsMapper.test.js)
- [useSanctionsCheck.test.js](src/__tests__/useSanctionsCheck.test.js)
- [useUsers.test.js](src/__tests__/useUsers.test.js)
