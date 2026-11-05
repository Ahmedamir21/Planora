BEGIN;

-- Link a staged draft to the exact sync run that produced it. This avoids
-- marking a different concurrent run from the same source as published.
ALTER TABLE planora.sync_drafts
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES planora.sync_runs(run_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sync_drafts_run_id_idx
  ON planora.sync_drafts (run_id) WHERE run_id IS NOT NULL;

COMMIT;
