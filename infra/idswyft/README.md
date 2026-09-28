# idswyft (self-hosted identity verification engine)

AML-Checker uses [idswyft-community](https://github.com/team-idswyft/idswyft-community) (MIT, see `LICENSE`)
as its document OCR / liveness / face-match engine. It runs as three containers defined in the root
`docker-compose.yml` under the `idswyft` Compose profile: `idswyft-postgres`, `idswyft-engine`, `idswyft-api`.
Their frontend is not used — customers go through our own `/verify/:token` page.

## Pinned version

| | |
|---|---|
| Release | `1.12.32` |
| Source commit | `198760e568c1d6c6f441fce1f4abd1651ec8737a` (2026-09-23) |
| `idswyft-api` | `ghcr.io/team-idswyft/idswyft-api@sha256:2b08ca2f40cfc9085c7ed3a95e6eaba4475f9d7afd51a4580552629871fcc93f` |
| `idswyft-engine` | `ghcr.io/team-idswyft/idswyft-engine@sha256:5da684c9c21afd6eec50ab40e128ab524f1c831277bc3b81e97cf089412f702e` |
| Imported | 2026-09-28 |

`migrations/` is a verbatim copy of `supabase/migrations/` from the same commit. The API image does not
ship its SQL migrations — they are mounted read-only into `/app/backend/migrations` and applied by the
container entrypoint on every start (already applied files are skipped). Supabase-only migrations
(RLS policies, storage buckets) are skipped by design (`MIGRATIONS_LENIENT=true`).

## Configuration notes

- `DATABASE_SSL=false` — idswyft enables SSL for every database host other than `localhost`/`postgres`.
- `RATE_LIMIT_ENABLED=false` — the default cap is 5 verifications / 24 h per developer account, and all
  AML-Checker organizations share one account.
- `AML_PROVIDER=none` — sanctions screening is done by `core-service` (Yente), not by idswyft.
- `STORAGE_ENCRYPTION=true` — uploaded files are encrypted with `ENCRYPTION_KEY`.
- `DATA_RETENTION_DAYS=14` — idswyft deletes verification data after 14 days.
- The engine downloads its PaddleOCR ONNX models (~13 MB) on the first OCR request into
  `/home/nodeuser/.cache`, kept in the `idswyft_engine_cache` volume. The recognition model is English
  (Latin script) — Polish diacritics may come back in their plain form (e.g. `Ł` → `L`).

## Updating

1. Pull the new images and read their source commit and digests:
   ```bash
   docker pull ghcr.io/team-idswyft/idswyft-api:latest
   docker pull ghcr.io/team-idswyft/idswyft-engine:latest
   docker image inspect ghcr.io/team-idswyft/idswyft-api:latest --format '{{index .Config.Labels "org.opencontainers.image.revision"}} {{json .RepoDigests}}'
   docker image inspect ghcr.io/team-idswyft/idswyft-engine:latest --format '{{index .Config.Labels "org.opencontainers.image.revision"}} {{json .RepoDigests}}'
   ```
   Both images must report the same revision.
2. Copy `supabase/migrations/` and `LICENSE` from **that exact commit** (outside this repo):
   ```bash
   git clone --filter=blob:none --sparse https://github.com/team-idswyft/idswyft-community.git
   cd idswyft-community && git sparse-checkout set supabase/migrations && git checkout <revision>
   ```
   and replace `infra/idswyft/migrations/` with it.
3. Replace both digests in `docker-compose.yml` and update the table above.
4. `docker compose up -d idswyft-api` and check the logs: migrations applied, no configuration errors.
5. Run `npm run idv:probe` on a test document and `npm run test:idv`; compare the responses with
   `idv-service/tests/fixtures/idswyft/` — field names are the contract of `IdswyftProvider`.

## Scripts

- `npm run idv:bootstrap` — one-time first-run setup; prints the API key for `IDSWYFT_API_KEY`.
- `npm run idv:probe -- <document.jpg> <selfie.jpg> [--save-fixtures] [--expect-reject] [--type national_id] [--country PL]`
  — runs the full identity flow directly against idswyft and prints responses with personal data masked.
