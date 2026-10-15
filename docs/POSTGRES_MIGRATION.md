# Planora PostgreSQL migration

## Goal

Move the live catalog and admin draft/publish workflow from file/Redis-backed catalog snapshots to PostgreSQL while keeping the current public JSON files in the repository as static reference/import input. JSON files are **not** regenerated on every save, and production is not switched until verification passes.

The schema is provider-neutral PostgreSQL and can run on a free Neon or Supabase project. No paid service is required by these files. Free tiers still have provider-defined usage limits and availability policies.

## Migration stages

1. **Foundation (this branch):** schema and one-time importer.
2. **Database verification:** apply the migration to a disposable PostgreSQL project and import the current published dataset.
3. **API adapter:** move published/draft catalog writes and revision/audit transactions into PostgreSQL. Keep unrelated report/feedback/rate-limit storage unchanged until explicitly migrated.
4. **Read cutover:** compare SQL reads with the current JSON contract and scheduler outputs.
5. **Preview deploy:** configure a preview-only DATABASE_URL, run smoke tests, and confirm admin save/publish/restore flows.
6. **Production cutover:** only after preview verification and a tested backup/restore. Never paste credentials into Git or this document.

## Schema layout

- planora.semesters: semester metadata and active semester.
- planora.catalog_documents: exact JSON-compatible document payloads for the current API contract, separated into published and draft states.
- planora.catalog_revisions: immutable version snapshots for rollback.
- planora.courses, planora.instructors, planora.meetings: normalized course and schedule data.
- planora.majors, planora.major_years, planora.major_year_courses: major/year/course mappings.
- planora.admin_audit_events: admin audit trail.
- planora.sync_runs: import/sync run status, counts, warnings and failures.

The exact document payload and SHA-256 hash are preserved alongside normalized rows. This protects against accidental information loss while the API is migrated in stages.

## Initial setup

1. Create a free PostgreSQL project with the provider you choose.
2. Use its pooled connection URL for the Vercel runtime if the provider recommends pooling; use a direct URL for one-off migration/backup commands where required.
3. Apply database/migrations/0001_initial_schema.sql using the provider's SQL editor or psql.
4. Set DATABASE_URL privately in your local shell. Never commit it or paste it into issues.
5. Run the one-time importer from the repository root after the importer is added and reviewed.

The one-time importer is available as `app/scripts/import-json-to-postgres.mjs`. From the repository root, after applying the schema and setting `DATABASE_URL` in the shell, run `cd app && npm run db:import-json`. It refuses to overwrite an existing catalog, validates source documents, writes exact documents plus normalized rows and revision-1 snapshots in one transaction, and rolls everything back if any row fails. It prints row counts after a successful commit.

## Backup and restore

- Run `app/scripts/backup-postgres.sh` with `DATABASE_URL` set privately in the shell to produce a timestamped compressed SQL dump using `pg_dump`.
- Store backup files outside the repository (for example, on a separate local drive); never commit database dumps or secrets.
- Periodically test restore into a separate empty database before trusting the backup.
- A SQL schema/migration file alone is not a data backup. The dump must include table data.
- Automated backup scheduling is a later step and will be configured only after the target provider and credentials are confirmed.

## Safety guarantees and limits

- PostgreSQL transactions make a multi-step publish atomic: all writes commit together or none do.
- Revision snapshots make application-level rollback possible; database backups cover disaster recovery.
- The migration does not enable public browser access to the private schema. Server-side API routes must be the only application entry point.
- The current API still uses the existing storage adapter until the API-adapter phase is implemented and verified. Adding this schema alone does **not** switch production to PostgreSQL.
- Monitoring and notifications are a later phase; no health-check traffic is treated as a promise that a free provider will never pause or hit usage limits.
