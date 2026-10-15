# Planora PostgreSQL migration checks

Run these commands from the repository root after applying the schema to a **disposable PostgreSQL database**.

1. Install dependencies: `cd app && npm ci`
2. Apply the base schema with your private database URL: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../database/migrations/0001_initial_schema.sql`
3. Apply follow-up migrations in numeric order, one command at a time: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../database/migrations/0002_expand_catalog_revision_actions.sql`, then `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../database/migrations/0003_sync_drafts_and_backups.sql`, then `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../database/migrations/0004_sync_draft_run_link.sql`.
4. Import the checked-in source catalog once: `npm run db:import-json`
5. Verify the import without modifying it: `npm run db:verify-import`

Set `DATABASE_URL` in your shell or secret manager. Never commit it, paste it into an issue, or put it in a workflow file.

The verifier is read-only. It checks that:
- all required migration tables exist;
- the four published JSON snapshots and their source SHA-256 hashes match;
- the immutable initial import revisions match those snapshots;
- normalized course payloads, instructor/meeting counts, majors, years, and major-to-course mappings match the checked-in JSON.

The importer intentionally refuses to overwrite an existing catalog and refuses stale/undated source data unless a deliberate one-off override is supplied. Use an empty disposable database for the first test. Do not use production credentials for migration testing.

**Important:** these checks do not mean the runtime API has migrated. The public catalog GET now reads the PostgreSQL snapshot when `PLANORA_STORAGE_BACKEND=postgres`; admin and sync-ingest intentionally return 503 in that mode until their writes/history/staging/publish/restore are migrated. Keep the flag unset and keep this pull request unmerged until those routes use one consistent transactional backend and pass end-to-end tests.

## PostgreSQL runtime primitives (not yet connected to HTTP routes)

The staged `app/api/postgres-store.ts` module now includes:
- an explicit `PLANORA_STORAGE_BACKEND=postgres` opt-in guard (unset by default);
- a small server-side connection pool and bounded transaction timeouts;
- draft save with content-hash compare-and-set, immutable revision, and audit event in one transaction;
- publish with both draft and published hashes checked, then revision/audit written atomically;
- restore from an immutable published revision as a new revision, with optimistic concurrency;
- a readiness query for the active semester and published document count.

These are persistence primitives, not a completed cutover. `catalog.ts` uses the PostgreSQL snapshot only when the explicit flag is selected; `admin.ts` and `sync-ingest.ts` fail closed in that mode instead of writing to Redis. Do not enable the flag for production until admin reads/writes, combined-dataset validation, sync draft/publish/backup/restore parity, authorization review, and end-to-end tests are complete. The primitives have not yet been exercised against a real PostgreSQL server in this environment.

## Required API cutover order

Do not enable a partial backend switch. Implement and verify the following as one feature branch:

1. **Shared catalog adapter:** public catalog reads now use the consistent snapshot helper in PostgreSQL mode. Finish admin reads/writes using the same active semester; keep bundled JSON only as an explicit bootstrap/reference fallback, never as a silent fallback after PostgreSQL has been selected.
2. **Admin route parity:** preserve the existing signed admin cookie and same-origin protections. Move draft/live reads, save, publish, undo/restore, revision history, and audit writes to the PostgreSQL adapter. Keep reports, feedback, security events, and rate limiting on Redis until their separate migration is designed; make their dependency explicit rather than claiming all admin storage moved.
3. **Whole-dataset validation:** before any catalog publish, combine the proposed document with the other current published documents, run the existing dataset validator, and reject invalid combinations before the write transaction. Preserve the rule that public catalog quick-save cannot add/remove course IDs.
4. **Sync parity:** store sync draft, status, and backup metadata in a consistent backend; ingestion must remain read-only against the student portal and draft-only. Publish/restore must validate the complete dataset and atomically update both courses.json and sch.json, revision history, audit, and sync status in one transaction.
5. **Optimistic concurrency:** hashes returned to the UI must be stable tokens from the selected backend. PostgreSQL jsonb normalizes JSON representation, so never recompute the database token from the serialized read response; pass the stored content_sha256 back for compare-and-set.
6. **Fail closed:** if PLANORA_STORAGE_BACKEND=postgres is selected but the database is unavailable or uninitialized, return a controlled 503. Never silently read or write Redis as a substitute for catalog data.
7. **Verification before preview:** test stale hashes, concurrent first draft saves, concurrent publish, invalid combined datasets, missing documents, rollback on transaction failure, restore creating a new revision, and the guarantee that sync staging never changes published data. Then run CI/build, the import verifier, and a preview-only end-to-end pass against a disposable database.

## Current verification snapshot

Earlier commits on this migration branch had Planner CI and Claude Security Review runs complete successfully, but the newest commits have no confirmed workflow results yet. This validates only the specific earlier commits; it does not prove database import/runtime behavior because no disposable PostgreSQL connection was configured for this work. The production API remains on its existing backend.

The storage layer exposes `readPostgresCatalogSnapshot()`: it reads the active semester and all published/draft catalog documents in a single SQL statement, requires all four published documents, rejects duplicate/unknown/incomplete document rows, and returns database-stored hashes. `catalog.ts` now uses it for public catalog GETs in PostgreSQL mode. This route and the new fail-closed admin/sync guards have not yet been exercised against a live PostgreSQL instance; admin and sync are intentionally unavailable while the flag is on.
