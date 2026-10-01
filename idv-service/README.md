# idv-service

Identity verification microservice of AML-Checker. Creates verification links for end customers,
tracks their status and stores results in its own PostgreSQL database `idv_db` (created on first start
in the shared `postgres` container). Reached only through `api-gateway` under `/idv`.

## Endpoints (internal paths)

| Method | Path | Auth (header `x-auth-type`) | Description |
|---|---|---|---|
| `POST` | `/verifications` | API key only | Create a verification link (`externalRef`, `customerName`, `redirectUrl` — all optional) |
| `POST` | `/verifications/demo` | user session only | Demo verification of the signed-in user |
| `GET` | `/verifications` | both | List (`page`, `limit` ≤ 100, `status`, `from`, `to`, `search`, `includeDemo`) |
| `GET` | `/verifications/:id` | both | Details; another organization's id → 404 |
| `GET` | `/verifications/:id/images/:kind` | both | `document` / `selfie`, decrypted, `Cache-Control: no-store`; 404 after retention |
| `POST` | `/verifications/:id/review` | user session only | `APPROVE` / `REJECT` (comment ≥ 3 chars required to reject) in `MANUAL_REVIEW` |
| `GET` | `/public/sessions/:token` | token | Customer page state: `step` = `CONSENT` / `DOCUMENT` / `SELFIE`, attempts left |
| `POST` | `/public/sessions/:token/start` | token | `{ consent: true }` — starts the 60-minute session, stores consent time and IP |
| `POST` | `/public/sessions/:token/document` | token | Multipart `document` (JPEG/PNG by magic bytes, ≤ 10 MB); 422 `DOCUMENT_REJECTED` with `attemptsLeft` |
| `POST` | `/public/sessions/:token/selfie` | token | Multipart `selfie`; 422 `SELFIE_REJECTED` only when no face was found |
| `GET` | `/health` | none | `{ service, status, provider, db }` |

The customer never receives the verification result (only `step: DONE` and the optional `redirectUrl`).

## Identity providers

- `idswyft` — self-hosted idswyft-community (`infra/idswyft/`). Every document attempt opens a new
  idswyft session; a selfie retry reopens a session with the stored accepted document. Provider errors
  and timeouts return 502 and do not count as an attempt.
- `fake` — deterministic, no ML. Markers in `customerName`: `[fake:review]`, `[fake:reject]`,
  `[fake:doc-fail]` (first document rejected), `[fake:no-face]` (first selfie without a face).

## Maintenance jobs (every `IDV_JOBS_INTERVAL_MS`)

1. Expire `PENDING` links after 72 h and `IN_PROGRESS` sessions after 60 minutes.
2. Delete stored images 14 days after creation (`imagesPurgedAt`); the result itself is kept.
3. Retry failed FULL_AML screenings.

All `/verifications*` routes require `x-org-id`, reject `x-role: superadmin` (403 `SUPERADMIN_FORBIDDEN`)
and organizations with `x-org-identity-mode: NONE` (403 `SERVICE_NOT_ENABLED`). Errors use
`{ error, code, ...extra }`.

## Security

- Link tokens: 32 random bytes (base64url); only the SHA-256 hash is used for lookups. The raw token is
  kept AES-256-GCM encrypted (`IDV_STORAGE_KEY`) only while the verification is `PENDING`, so the panel
  can show the link again.
- Logs contain ids, statuses and times only — never tokens or personal data.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `IDV_DB_NAME` | `idv_db` | Created on startup if missing |
| `DB_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | | Shared Postgres |
| `IDV_PROVIDER` | `idswyft` | `idswyft` or `fake` |
| `IDSWYFT_API_URL`, `IDSWYFT_API_KEY`, `IDSWYFT_TIMEOUT_MS` | `http://idswyft-api:3001`, –, `90000` | idswyft connection |
| `CORE_SERVICE_URL` | `http://core-service:3000` | Sanctions screening (FULL_AML) |
| `FRONTEND_URL` | `http://localhost` | Base of `verificationUrl` (`<FRONTEND_URL>/verify/<token>`) |
| `IDV_STORAGE_DIR` | `/app/data` | Encrypted images (volume `idv_data`) |
| `IDV_STORAGE_KEY` | – | 64 hex chars, required (fail-fast) |
| `IDV_LINK_TTL_HOURS`, `IDV_SESSION_TTL_MINUTES`, `IDV_IMAGE_RETENTION_DAYS` | `72`, `60`, `14` | |
| `IDV_MAX_DOCUMENT_ATTEMPTS`, `IDV_MAX_SELFIE_ATTEMPTS` | `3`, `3` | |
| `IDV_JOBS_INTERVAL_MS` | `300000` | Maintenance jobs |

## Tests

```bash
npm test        # or from the repo root: npm run test:idv
npm run build
```
