# idswyft response fixtures

Contract of idswyft-community 1.12.32 (commit `198760e`) used by `IdswyftProvider` and its tests.

- `initialize.json`, `front-document-rejected.json` — real responses of the pinned instance to a
  synthetic image (tokens redacted).
- The other files follow the response shapes in the idswyft source (`routes/newVerification.js`,
  `verification/statusReader.js`, `@idswyft/shared` schemas) with fictional data.
- `recorded/` (optional) — masked responses from `npm run idv:probe -- ... --save-fixtures` on a real
  document. When present, `idswyftContract.test.ts` checks that the mapping still reads them.
  Review them for personal data before committing.
