BEGIN;

-- Keep the append-only history schema aligned with all admin/sync actions.
-- The initial migration's CHECK was too narrow for draft undo, direct publish,
-- sync discard/restore, and rejected/export events.
ALTER TABLE planora.catalog_revisions
  DROP CONSTRAINT IF EXISTS catalog_revisions_action_check;
ALTER TABLE planora.catalog_revisions
  ADD CONSTRAINT catalog_revisions_action_check
  CHECK (action IN (
    'import',
    'save_draft',
    'undo_draft',
    'publish',
    'save_live',
    'undo_live',
    'restore',
    'sync_stage',
    'sync_discard',
    'sync_publish',
    'sync_restore',
    'sync_rejected',
    'export_draft'
  ));

COMMIT;
