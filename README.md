# AML Checker
> Microservice-based platform for automatic sanctions and PEP screening using a local OpenSanctions (Yente) instance plus a lightweight organization/user management module.

## Table of Contents
* [General Information](#general-information)
* [Architecture](#architecture)
* [Technologies Used](#technologies-used)
* [Features](#features)
* [Setup](#setup)
* [Usage](#usage)
* [Project Status](#project-status)
* [Room for Improvement](#room-for-improvement)
* [Acknowledgements](#acknowledgements)
* [Contact](#contact)

## General Information
- Goal: provide a local, reproducible environment to screen customers against OpenSanctions data and register organizations with API keys.
- Uses Yente as the local API (fed by [manifest.yml](manifest.yml)) and an auth service for creating organizations and users.
- The stack starts via Docker Compose, including MongoDB for auth-service and Elasticsearch + Yente for sanctions data.

## Architecture
- op-adapter: Exposes GET `/check` over Yente, maps responses, health at `/health` ([op-adapter/src/index.js](op-adapter/src/index.js)). Container port 3000, mapped to 3001 by default.
- auth-service: Registers organizations and users, generates API keys, health at `/health`, routes in [auth-service/src/routes/authRoutes.js](auth-service/src/routes/authRoutes.js). Container port 3000, mapped via `PORT_AUTH` (default 3002). Login with JWT is implemented.
- yente: Image `ghcr.io/opensanctions/yente:5.1.0`, backed by Elasticsearch (single-node) and the provided manifest.
- Datastores: MongoDB (in use); PostgreSQL prepared for core-service (not implemented); volumes for Yente/ES/Mongo/Postgres data.

## Technologies Used
- Node.js 18, Express 5, ES Modules
- MongoDB 6 (Mongoose 9), PostgreSQL 15 (planned)
- OpenSanctions Yente 5.1 + Elasticsearch 8.11
- Docker Compose 3.8
- axios, bcryptjs, jsonwebtoken (JWT-based login implemented), cors, dotenv

## Features
- Sanctions/PEP screening via GET `/check?name=` (op-adapter) with Yente result mapping.
- Organization registration with `apiKey` generation and one-time `apiSecret` reveal (hash stored) plus admin creation ([auth-service/src/routes/authRoutes.js](auth-service/src/routes/authRoutes.js)).
- User registration tied to an existing organization.
- User login returning a JWT valid for 8 hours (requires `JWT_SECRET`).
- Health checks for op-adapter, auth-service, and Yente.
- Environment configuration via [.env.example](.env.example) and data volumes for services.

## Setup
1. Requirements: Docker + Docker Compose. Optionally Node 18 to run individual services locally.
2. Clone the repository and copy `.env.example` to `.env`; fill in passwords/ports securely (set `JWT_SECRET` for login).
3. Start the stack: `docker compose up --build` from the repository root.
4. Default ports:
	 - op-adapter: http://localhost:3001
	 - auth-service: http://localhost:3002
	 - Yente API: http://localhost:${YENTE_PORT} (default 8000)
	 - Elasticsearch: http://localhost:9200 (debug)
5. Yente datasets are downloaded on startup (see [manifest.yml](manifest.yml)); volumes `yente_data` and `es_data` keep the data.

## Usage
- Health checks:
	- `curl http://localhost:3001/health`
	- `curl http://localhost:3002/health`
- Register organization (admin + API keys):
```bash
curl -X POST http://localhost:3002/auth/register-organization \
	-H "Content-Type: application/json" \
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
- Register user in an existing organization (`organizationId` comes from organization registration response):
```bash
curl -X POST http://localhost:3002/auth/register-user \
	-H "Content-Type: application/json" \
	-d '{
		"email": "user@acme.test",
		"password": "Str0ngPass!",
		"firstName": "Jane",
		"lastName": "Doe",
		"organizationId": "<ORG_ID>"
	}'
```
- User login (returns JWT):
```bash
curl -X POST http://localhost:3002/auth/login \
	-H "Content-Type: application/json" \
	-d '{
		"email": "admin@acme.test",
		"password": "Str0ngPass!"
	}'
```
- Sanctions/PEP check:
```bash
curl "http://localhost:3001/check?name=John%20Doe"
```
Response includes mapped flags `isSanctioned`, `isPep`, and fields `country`, `birthDate`, `notes`, `score` from Yente.

## Project Status
- Status: in progress. Running services: op-adapter, auth-service. core-service/frontend/infrastructure not yet implemented.

## Room for Improvement
- Add authorization middleware to protect endpoints using JWT.
- Implement core-service for request logging/auditing (PostgreSQL) and extend business logic.
- Add rate limiting, schema validation, and unit/integration tests.
- Build frontend and publish API documentation (OpenAPI/Swagger) for services.

## Acknowledgements
- OpenSanctions/Yente for datasets and reference image.

## Contact
- Services author: Adam Weglewski (per op-adapter package.json). For technical matters: open an issue or pull request in the repository.