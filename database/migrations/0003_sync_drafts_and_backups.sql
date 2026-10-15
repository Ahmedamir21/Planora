BEGIN;

-- Self-service sync data is deliberately separate from per-file admin drafts.
-- This prevents a crawler draft from overwriting an admin editor's work.
CREATE TABLE IF NOT EXISTS planora.sync_drafts (
  semester_key text PRIMARY KEY REFERENCES planora.semesters(semester_key) ON DELETE CASCADE,
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  content_sha256 char(64) NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  status jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(status) = 'object'),
  source text NOT NULL,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS planora.sync_backups (
  semester_key text NOT NULL REFERENCES planora.semesters(semester_key) ON DELETE CASCADE,
  version text NOT NULL,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_by text,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (semester_key, version)
);
CREATE INDEX IF NOT EXISTS sync_backups_recent_idx
  ON planora.sync_backups (semester_key, created_at DESC);

COMMIT;
