# Planora PostgreSQL migration checks

Run these commands from the repository root after applying the schema to a **disposable PostgreSQL database**.

1. Install dependencies: `cd app && npm ci`
2. Apply the schema with your private database URL: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../database/migrations/0001_initial_schema.sql`
3. Import the checked-in source catalog once: `npm run db:import-json`
4. Verify the import without modifying it: `npm run db:verify-import`

Set `DATABASE_URL` in your shell or secret manager. Never commit it, paste it into an issue, or put it in a workflow file.

The verifier is read-only. It checks that:
- all required migration tables exist;
- the four published JSON snapshots and their source SHA-256 hashes match;
- the immutable initial import revisions match those snapshots;
- normalized course payloads, instructor/meeting counts, majors, years, and major-to-course mappings match the checked-in JSON.

The importer intentionally refuses to overwrite an existing catalog and refuses stale/undated source data unless a deliberate one-off override is supplied. Use an empty disposable database for the first test. Do not use production credentials for migration testing.

**Important:** these checks do not mean the runtime API has migrated. The existing catalog/admin/sync handlers still use Redis for live overrides, drafts, and history. Keep this pull request unmerged and do not enable a PostgreSQL runtime flag until catalog reads, admin writes, sync staging/publishing, history, and restore all use one consistent transactional backend and pass end-to-end tests.
