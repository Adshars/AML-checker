# AML-Checker

Microservice-based platform for sanctions and PEP screening using OpenSanctions (Yente). Includes API Gateway, Auth Service, Core Service, OP-Adapter, and a React frontend. Deployable via Docker Compose.

**Version:** 1.0.0

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Quick Start

1) Clone and configure:
```bash
git clone <repository-url>
cd AML-Checker
cp .env.example .env
# Edit .env with strong secrets
```

2) Start the stack:
```bash
docker compose up --build
```

3) Access:
- Frontend: http://localhost (mapped to Vite dev server on 5173)
- API Gateway: http://localhost:8080
- API Docs: http://localhost:8080/api-docs
- Yente: http://localhost:8000

4) Create the first SuperAdmin (MongoDB):
```bash
docker exec -it mongo-1 mongosh
use auth_db

var orgId = new ObjectId();
db.organizations.insertOne({
  _id: orgId,
  name: "AML System Corp",
  country: "Global",
  city: "System",
  address: "Root Level",
  apiKey: "sys-" + Math.random().toString(36).substring(7),
  createdAt: new Date()
});

db.users.insertOne({
  email: "super@admin.com",
  passwordHash: "$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa",
  firstName: "System",
  lastName: "SuperAdmin",
  role: "superadmin",
  organizationId: orgId,
  createdAt: new Date()
});

print("SuperAdmin created");
```

---

## Architecture

Services (Docker Compose defaults):
- **API Gateway**: exposed on `GATEWAY_PORT` (default 8080)
- **Frontend**: exposed on port 80 (Vite dev server on 5173)
- **Auth Service**: internal only by default
- **Core Service**: internal only by default
- **OP-Adapter**: internal only by default
- **MongoDB**: exposed on `MONGO_PORT` (default 27017)
- **PostgreSQL**: exposed on `POSTGRES_PORT` (default 5432)
- **Yente**: exposed on `YENTE_PORT` (default 8000)
- **Elasticsearch**: exposed on 9200

For service-level details, see:
- [api-gateway/README.md](api-gateway/README.md)
- [auth-service/README.md](auth-service/README.md)
- [core-service/README.md](core-service/README.md)
- [op-adapter/README.md](op-adapter/README.md)
- [frontend/README.md](frontend/README.md)

---

## Authentication

**JWT (user login)**
- `Authorization: Bearer <ACCESS_TOKEN>`
- Refresh token is stored as an HttpOnly cookie
- Refresh flow: `POST /auth/refresh` (cookie-based)

**API Key (B2B)**
- `x-api-key: pk_live_XXXXXX`
- `x-api-secret: sk_live_YYYYYY`

---

## API Endpoints

All requests go through the API Gateway (`http://localhost:8080`).

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password`
- `POST /auth/register-organization` (superadmin)
- `POST /auth/register-user` (admin/superadmin)
- `POST /auth/reset-secret`
- `GET /auth/organization/keys`
- `GET /users`
- `POST /users`
- `DELETE /users/:id`
- `GET /sanctions/check`
- `GET /sanctions/history`
- `GET /sanctions/stats`
- `GET /health`

See the service READMEs for detailed request/response formats.

---

## Testing

Root scripts (see [package.json](package.json)):
```bash
npm test
npm run test:auth
npm run test:core
npm run test:adapter
npm run test:gateway
npm run test:frontend
```

---

## Troubleshooting

- Yente downloads datasets on first startup (can take minutes).
- If gateway returns 401, verify JWT or API key headers.
- If audit logs are missing, check core-service logs and PostgreSQL status.
- Services not starting: `docker compose logs <service>`.

---

## License

See each service README and package metadata for license details.
