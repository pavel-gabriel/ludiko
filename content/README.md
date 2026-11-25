# content/

Learning content and third-party asset records for Ludiko (see `docs/PLAN.md` §5).

**Before adding anything here, read [`docs/LEGAL_CONTENT_POLICY.md`](../docs/LEGAL_CONTENT_POLICY.md).**

- `credits.json` — every third-party asset/library shipped in the app (shown on `/credits`).
- `schema/provenance.schema.json` — required `provenance` shape for assets and content records.
- Any object with a `provenance` key in any `.json` file under `content/` is validated by
  `tests/contentPolicy.test.ts` (runs in CI before deploy).
