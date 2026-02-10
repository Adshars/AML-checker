# AML-Checker 🔍

Microservice-based platform for automatic **sanctions and PEP screening**. Real-time entity validation against OpenSanctions (OFAC, UN, EU, etc.), complete audit logging, multi-organization support with role-based access control, and comprehensive REST API with JWT + API Key authentication. Deployable via Docker Compose with React web interface.

**Version:** 1.0.0 | **Status:** Production Ready | **License:** MIT

---

## Table of Contents

### Overview
- [What is AML-Checker?](#what-is-aml-checker)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
  - [Microservice Design](#microservice-design)
  - [Request Flow](#request-flow)
  - [Data Isolation](#data-isolation)

### Core Services
- [API Gateway](#api-gateway-service)
- [Auth Service](#auth-service)
- [Core Service](#core-service)
- [OP-Adapter](#op-adapter-service)
- [Frontend](#frontend-application)
- [Data Stores](#data-stores)
- [Yente](#yente-sanctions-api)

### API Reference
- [Authentication Methods](#authentication-methods)
- [Complete Endpoint Reference](#complete-endpoint-reference)
- [Response Examples](#response-examples)

### Development & Operations
- [Technologies](#technologies)
- [Setup & Installation](#setup--installation)
- [Testing](#testing)
- [Platform Features](#platform-features)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

### Project Information
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)
- [Contact](#contact)

---

## What is AML-Checker?

**AML-Checker** is a comprehensive sanctions and PEP screening platform designed for financial institutions, compliance teams, and fintech companies. It provides:

- 🔍 **Real-time Entity Screening** – Check individuals and companies against OpenSanctions databases
- 📊 **Audit & Compliance** – Complete request history with advanced filtering and analytics
- 🏢 **Multi-tenant** – Organization isolation with role-based access control (RBAC)
- 🔐 **Enterprise Authentication** – JWT tokens + API keys for B2B integrations
- 📈 **Scalable Architecture** – Microservices design, containerized deployment
- 🌐 **Modern API** – RESTful endpoints with comprehensive documentation
- 💻 **Web Interface** – React SPA with responsive design and role-based UI
- ✅ **Production-Ready** – Error handling, retries, caching, rate limiting

### Common Use Cases
1. **KYC/AML Process** – Screen clients during onboarding
2. **Ongoing Monitoring** – Monitor existing customers for sanctions changes
3. **API Integration** – B2B screening via API keys for partner systems
4. **Compliance Reporting** – Track and analyze screening history
5. **Internal Tools** – Embed screening into internal applications

---

## Quick Start

### 1. Clone & Configure
```bash
git clone <repository-url>
cd AML-Checker
cp .env.example .env
# Edit .env with strong secrets
```

### 2. Start Services
```bash
docker compose up --build
```

### 3. Create SuperAdmin
```bash
docker exec -it mongo-1 mongosh
use auth_db
# Paste seeding script from Initial Setup section
```

### 4. Access Platform
- **Frontend**: http://localhost:80
- **API Docs**: http://localhost:8080/api-docs
- **Login**: super@admin.com / admin123 (change immediately!)

---

## Architecture

### Microservice Design

AML-Checker uses a **microservice-based architecture** with 7 independent services:

```
Frontend (React) → API Gateway (8080) → {Auth Service, Core Service, OP-Adapter}
                                                     ↓
                                        {MongoDB, PostgreSQL, Yente+Elasticsearch}
```

**Services:**
1. **API Gateway** – Central authentication & routing (port 8080)
2. **Auth Service** – User & organization management (port 3000, MongoDB)
3. **Core Service** – Sanctions checking & audit (port 3000, PostgreSQL)
4. **OP-Adapter** – Yente API wrapper (port 3000)
5. **Frontend** – React web application (port 5173/80)
6. **Yente** – OpenSanctions data API (port 8000)
7. **Data Stores** – MongoDB, PostgreSQL, Elasticsearch

[Full Architecture Documentation](api-gateway/README.md)

### Request Flow

1. User/API client → API Gateway (JWT or API Key auth)
2. Gateway validates credentials, injects context headers
3. Routes to Auth Service (login/register) or Core Service (screening)
4. Core Service → OP-Adapter → Yente (sanctions check)
5. Core Service logs audit to PostgreSQL
6. Response returned through gateway to client

### Data Isolation

- Organizations can only access their own data
- Users isolated by organization
- Superadmin can view all organizations
- Context headers enforce isolation

---

## API Gateway Service

Central authentication and routing for all requests.

**Features:** JWT + API Key auth, rate limiting, context injection, API key caching
**Port:** 8080 | **Docs:** [api-gateway/README.md](api-gateway/README.md)

---

## Auth Service

User, organization, and authentication management.

**Features:** Multi-tenant, user/org management, JWT+refresh tokens, password reset, API keys
**Database:** MongoDB 6 | **Port:** 3000 | **Docs:** [auth-service/README.md](auth-service/README.md)

---

## Core Service

Sanctions checking orchestration and audit logging.

**Features:** Real-time screening, audit logging, pagination, advanced filtering, statistics
**Database:** PostgreSQL 15 | **Port:** 3000 | **Docs:** [core-service/README.md](core-service/README.md)

---

## OP-Adapter Service

Lightweight wrapper around Yente (OpenSanctions) API.

**Features:** Response mapping, retry mechanism, parameter validation
**Database:** None (stateless) | **Port:** 3000 | **Docs:** [op-adapter/README.md](op-adapter/README.md)

---

## Frontend Application

React SPA for entity screening and audit management.

**Framework:** React 19.2.0, Vite 7.2.4, Bootstrap 5.3.8
**Port:** 5173/80 | **Tests:** 27 | **Docs:** [frontend/README.md](frontend/README.md)

---

## Data Stores

- **MongoDB** (Auth) – Organizations, users, API keys
- **PostgreSQL** (Core) – Audit logs
- **Elasticsearch** (Yente) – Sanctions data

---

## Yente (Sanctions API)

OpenSanctions local API instance powered by Elasticsearch.

**Features:** OFAC/UN/EU sanctions, fuzzy search, comprehensive datasets
**Port:** 8000 | **Image:** ghcr.io/opensanctions/yente:5.1.0

---

## Authentication Methods

### JWT Authentication (User Login)
```bash
Authorization: Bearer <ACCESS_TOKEN>
Cookie: refreshToken=<REFRESH_TOKEN> (HttpOnly)
```
- Access token: 15 minutes (Storage: Memory/LocalStorage)
- Refresh token: 7 days (Storage: HttpOnly Cookie)
- Use `/auth/refresh` to get new access token (cookie handled automatically)

### API Key Authentication (B2B)
```bash
x-api-key: pk_live_XXXXXX
x-api-secret: sk_live_YYYYYY
```
- Validates against Auth Service (cached 60s)
- Use for system-to-system integration
- Secrets can be regenerated via `/auth/reset-secret`

---

## Complete Endpoint Reference

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| POST | `/auth/register-organization` | JWT | superadmin | Register organization |
| POST | `/auth/register-user` | JWT | admin | Add user to org |
| POST | `/auth/login` | ❌ | - | User login |
| POST | `/auth/refresh` | ❌ | - | Refresh token |
| POST | `/auth/logout` | ❌ | - | Logout |
| POST | `/auth/forgot-password` | ❌ | - | Password reset request |
| POST | `/auth/reset-password` | ❌ | - | Reset password |
| POST | `/auth/change-password` | JWT | - | Change password |
| POST | `/auth/reset-secret` | JWT | admin | Reset API secret |
| GET | `/auth/organization/keys` | JWT | - | Get API keys |
| GET | `/users` | JWT | admin | List org users |
| POST | `/users` | JWT | admin | Create user |
| DELETE | `/users/:id` | JWT | admin | Delete user |
| GET | `/sanctions/check` | JWT/Key | - | Sanctions check |
| GET | `/sanctions/history` | JWT/Key | - | Audit history |
| GET | `/sanctions/stats` | JWT/Key | - | Statistics |
| GET | `/health` | ❌ | - | Health check |

For detailed documentation, see individual service READMEs above.

---

## Response Examples

### Sanctions Check
```json
{
  "entityName": "John Doe",
  "hits_count": 1,
  "data": [
    {
      "name": "John Doe",
      "schema": "Person",
      "isSanctioned": true,
      "isPep": false,
      "score": 0.98,
      "country": ["US"],
      "birthDate": "1970-01-01"
    }
  ]
}
```

### Audit History
```json
{
  "data": [
    {
      "id": "550e8400...",
      "searchQuery": "John Doe",
      "hasHit": true,
      "hitsCount": 1,
      "createdAt": "2025-12-28T10:30:00Z"
    }
  ],
  "meta": {
    "totalItems": 150,
    "currentPage": 1,
    "totalPages": 8
  }
}
```

---

## Technologies

- **Runtime:** Node.js 18+, ES Modules
- **API:** Express 5
- **Frontend:** React 19.2.0, Vite 7.2.4, Bootstrap 5.3.8
- **Databases:** MongoDB 6, PostgreSQL 15, Elasticsearch 8.11
- **Auth:** JWT, bcryptjs, API Keys
- **Testing:** Jest (backend), Vitest (frontend), Supertest
- **Infrastructure:** Docker Compose 3.8

---

## Setup & Installation

### Requirements
- Docker + Docker Compose
- Node.js 18 (optional, for local development)
- MongoDB CLI (for SuperAdmin setup)

### Quick Start
```bash
git clone <repository-url>
cd AML-Checker
cp .env.example .env
docker compose up --build
```

Wait 2-5 minutes for services to initialize. Then access:
- **Frontend:** http://localhost:80
- **API Docs:** http://localhost:8080/api-docs
- **Default Login:** super@admin.com / admin123

### Initial SuperAdmin Setup

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

print("✅ SuperAdmin created!");
```

**⚠️ Change default password immediately after first login!**

For full setup documentation, see [Setup Instructions](setup--installation).

---

## Testing

**130 total tests** covering all microservices:

```bash
npm test              # Run all tests
npm run test:auth    # Auth Service (31 tests)
npm run test:core    # Core Service (34 tests)
npm run test:adapter # OP Adapter (35 tests)
npm run test:gateway # API Gateway (3 tests)
npm run test:frontend # Frontend (27 tests)
```

For detailed test documentation, see individual service READMEs.

---

## Platform Features

✅ Multi-organization support with role-based access  
✅ JWT + API Key authentication  
✅ Real-time sanctions screening  
✅ Complete audit logging  
✅ Advanced filtering & pagination  
✅ Password reset with email  
✅ API key generation & rotation  
✅ Health checks for all services  
✅ Automatic retry mechanism  
✅ API caching (60s TTL)  
✅ Rate limiting  
✅ Docker deployment  

---

## Usage Examples

### Register Organization
```bash
curl -X POST http://localhost:8080/auth/register-organization \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "orgName": "ACME Corp",
    "country": "US",
    "city": "New York",
    "address": "123 Main St",
    "email": "admin@acme.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### User Login
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.com",
    "password": "SecurePass123!"
  }'
```

### Sanctions Check (JWT)
```bash
curl -X GET "http://localhost:8080/sanctions/check?name=John%20Doe" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Sanctions Check (API Key)
```bash
curl -X GET "http://localhost:8080/sanctions/check?name=John%20Doe" \
  -H "x-api-key: pk_live_xxxxxx" \
  -H "x-api-secret: sk_live_yyyyyy"
```

### Get Audit History
```bash
curl -X GET "http://localhost:8080/sanctions/history?page=1&limit=20&search=John" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

For more examples, see [Usage Examples](usage-examples).

---

## Troubleshooting

**Services not starting?**
```bash
docker compose logs <service>
docker compose restart
```

**Yente taking too long?**
- First startup downloads sanctions data (2-5 GB, normal)
- Subsequent startups are faster

**401 Unauthorized?**
- Check JWT token validity
- Ensure both API key and secret are present
- Verify organization is registered

**Audit logs not appearing?**
- Verify PostgreSQL is running
- Check Core Service logs
- Ensure context headers are injected by Gateway

**Database connection errors?**
```bash
docker compose ps
docker compose logs auth-service
docker compose logs core-service
```

**Reset everything:**
```bash
docker compose down -v    # WARNING: Deletes all data
docker compose up --build
```

For more troubleshooting, see individual service documentation.

---

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Follow microservice structure
4. Write tests for new functionality
5. Update documentation
6. Submit a pull request

### Code Style
- ES Modules (Node.js 18+)
- Express/Node.js conventions
- JSDoc comments for public functions
- Comprehensive tests

---

## Acknowledgements
- [OpenSanctions](https://www.opensanctions.org/) for comprehensive sanctions and PEP data
- [Yente API](https://github.com/opensanctions/yente) for local sanctions API implementation
- All open-source libraries and frameworks used in this project

---

## Contact
Created by Adam Węglewski - feel free to contact me!

---

## License
This project is open source and available under the [MIT License](LICENSE).
