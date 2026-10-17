# Planora PostgreSQL migration checks

## Safety status (2026-10-16)

The connected Supabase project `Plan-Database` (ref `ultkchmuuhpppqmkbgxx`) is **not** a disposable empty database. Its existing `planora` schema has a different layout and migration history, including `terms`, `catalogs`, `catalog_state`, `instructor_groups`, and `admin_kv_store`. This PR's migrations expect a different layout, including `semesters`, `catalog_documents`, `catalog_revisions`, and `instructors`. Migration 0001 uses `CREATE TABLE IF NOT EXISTS`, which does not convert incompatible existing tables. **Do not apply this PR's migrations/importer to that existing project.** First use a separate disposable PostgreSQL database or design and review an explicit compatibility migration. Do not drop or overwrite existing tables/data.

Supabase's security advisor flags RLS disabled on 20 tables in the existing `planora` schema as critical. The current tooling has not conclusively verified effective grants and Data API exposure for this schema; treat actual exposure as unresolved. Do not assume the tables are public or safe based on RLS status alone. Review schema exposure and effective grants using an approved read-only method. Do not enable RLS without deliberately designing policies and confirming server-side access, because enabling it without policies can block access.

## Test only against a disposable database

Run these commands from the repository root after setting a private `DATABASE_URL` for a **disposable PostgreSQL database**:

1. Install dependencies: `cd app && npm ci`
2. Apply the base schema: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../database/migrations/0001_initial_schema.sql`
3. Apply follow-up migrations sequentially, one at a time:
   - `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../database/migrations/0002_expand_catalog_revision_actions.sql`
   - `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../database/migrations/0003_sync_drafts_and_backups.sql`
   - `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../database/migrations/0004_sync_draft_run_link.sql`
4. Import the checked-in source catalog once: `npm run db:import-json`
5. Verify the import without modifying it: `npm run db:verify-import`

Never commit or paste `DATABASE_URL` into an issue, workflow file, or repository. The importer refuses to overwrite an existing catalog and rejects stale/undated source data unless a deliberate one-off override is supplied. Use an empty disposable database for the first test.

The verifier checks required migration tables, the four published JSON snapshots and source SHA-256 hashes, immutable initial import revisions, and normalized course/instructor/meeting/major/year/mapping identities. This has **not** yet been run against a real disposable database in this work.

## Actual runtime status

The migration branch is a **partial, opt-in backend path**, not a completed cutover:

- Public catalog GET can read the PostgreSQL snapshot when `PLANORA_STORAGE_BACKEND=postgres`.
- Some admin catalog/history and sync draft/publish/restore paths have PostgreSQL-backed branches.
- Admin authentication/session configuration and rate limiting still depend on the existing Redis-backed configuration.
- Reports, feedback, security-event storage, and other unsupported legacy paths are not fully migrated; some return 503 in PostgreSQL mode.
- `sync-ingest` is not fully migrated and returns 503 in PostgreSQL mode rather than silently falling back.
- If PostgreSQL mode is selected but `DATABASE_URL` is missing, guarded routes fail closed. Keep the flag unset in production until the remaining routes and operational dependencies are migrated and tested together.

CI passing does not prove database behavior. No live database migration, JSON import equivalence, publish/restore transaction, or backup recovery has been validated for this branch. Vercel preview availability is also unconfirmed because the free deployment quota was previously exceeded.

## Required verification before any production cutover

1. Use a disposable/free PostgreSQL database after checking provider cost and connection settings.
2. Apply migrations sequentially and run the importer and verifier; compare source hashes, row counts, and normalized identities.
3. Test catalog reads, draft save, publish, undo/restore, sync stage/discard/publish/restore, backup recovery, stale hashes, concurrent writes, invalid combined datasets, missing documents, and transaction rollback.
4. Preserve the existing signed admin cookie and same-origin checks. Decide explicitly which features stay on Redis and migrate them consistently before selecting PostgreSQL in production.
5. Ensure the whole-dataset validator runs before publishing and that sync collection remains read-only against the student portal, stages drafts only, and never changes published data before explicit admin approval.
6. Run CI, a real disposable-database integration suite, and a preview-only end-to-end acceptance test.
7. Complete an actual security review, including effective grants, exposed schemas, RLS policy design, and secret handling.

The PR must remain a draft and unmerged until these checks pass and the user reviews the preview. Never use the existing `Plan-Database` project as the migration test target without a separately reviewed compatibility plan.
