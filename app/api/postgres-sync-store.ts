import { createHash } from 'node:crypto';
import { withPostgresTransaction } from './postgres-store';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

type CatalogName = 'courses.json' | 'sch.json';

export type PostgresSyncDraft = {
  source: string;
  fetchedAt: string;
  stagedAt: string;
  courses: unknown[];
  sch: unknown[];
  validation?: unknown;
  changes?: unknown;
};

/**
 * Stage a self-service sync result without touching published catalog rows.
 * expectedDraftHash is the hash previously shown to the admin (empty if absent).
 */
export async function stagePostgresSyncDraft(args: {
  draft: PostgresSyncDraft;
  expectedDraftHash: string;
  actorId: string;
  actorName: string;
  status: Record<string, unknown>;
}): Promise<{ staged: true; contentSha256: string } | { staged: false }> {
  if (!args.draft.source?.trim() || !Array.isArray(args.draft.courses) || !Array.isArray(args.draft.sch)) {
    throw new Error('Sync draft must include a source, courses, and schedule arrays.');
  }
  const content = JSON.stringify(args.draft);
  const contentSha256 = sha256(content);
  return withPostgresTransaction(async client => {
    const active = await client.query<{ semester_key: string }>(
      'SELECT semester_key FROM planora.semesters WHERE is_active=true FOR UPDATE'
    );
    if (active.rowCount !== 1) throw new Error('PostgreSQL must contain exactly one active semester.');
    const semesterKey = active.rows[0].semester_key;
    const current = await client.query<{ content_sha256: string }>(
      'SELECT content_sha256 FROM planora.sync_drafts WHERE semester_key=$1 FOR UPDATE',
      [semesterKey],
    );
    if ((current.rows[0]?.content_sha256.trim() || '') !== args.expectedDraftHash) return { staged: false as const };
    // A reviewed replacement supersedes the previous pending run; keep its history,
    // but do not leave it appearing as a still-publishable validated run.
    const previousRunId = current.rows[0]?.run_id;
    if (previousRunId) {
      await client.query(
        "UPDATE planora.sync_runs SET status='rejected', phase='draft_superseded', " +
        "error_summary='Superseded by a newer staged draft.', completed_at=now() " +
        "WHERE run_id=$1 AND status='validated'",
        [previousRunId],
      );
    }
    const run = await client.query<{ run_id: string }>(
      "INSERT INTO planora.sync_runs (source, status, phase, counts, warnings, started_at, completed_at) " +
      "VALUES ($1,'validated','draft_ready',$2::jsonb,$3::jsonb,now(),now()) RETURNING run_id",
      [
        args.draft.source.trim().slice(0, 240),
        JSON.stringify({ courses: args.draft.courses.length + args.draft.sch.length }),
        JSON.stringify((args.draft.validation as { warnings?: unknown[] } | undefined)?.warnings || []),
      ],
    );
    await client.query(
      'INSERT INTO planora.sync_drafts (semester_key, content, content_sha256, status, source, updated_by, run_id) ' +
      'VALUES ($1,$2::jsonb,$3,$4::jsonb,$5,$6,$7) ' +
      'ON CONFLICT (semester_key) DO UPDATE SET content=EXCLUDED.content, content_sha256=EXCLUDED.content_sha256, ' +
      'status=EXCLUDED.status, source=EXCLUDED.source, updated_by=EXCLUDED.updated_by, run_id=EXCLUDED.run_id, updated_at=now()',
      [semesterKey, content, contentSha256, JSON.stringify(args.status), args.draft.source.trim().slice(0, 240), args.actorId, run.rows[0].run_id],
    );
    await client.query(
      'INSERT INTO planora.admin_audit_events (actor_id, actor_name, action, metadata) VALUES ($1,$2,$3,$4::jsonb)',
      [args.actorId, args.actorName, 'sync_stage', JSON.stringify({ semesterKey, source: args.draft.source, contentSha256 })],
    );
    return { staged: true as const, contentSha256 };
  });
}

/** Return sync draft metadata and payload, or null when no draft exists. */
export async function readPostgresSyncDraft(): Promise<{
  content: PostgresSyncDraft;
  contentSha256: string;
  status: Record<string, unknown>;
} | null> {
  const { postgresPool, activeSemesterKey } = await import('./postgres-store');
  const semesterKey = await activeSemesterKey();
  const result = await postgresPool().query<{
    content: PostgresSyncDraft;
    content_sha256: string;
    status: Record<string, unknown>;
  }>(
    'SELECT content, content_sha256, status FROM planora.sync_drafts WHERE semester_key=$1',
    [semesterKey],
  );
  if (result.rowCount !== 1) return null;
  return { content: result.rows[0].content, contentSha256: result.rows[0].content_sha256.trim(), status: result.rows[0].status };
}

/**
 * Atomically back up and publish both course JSON snapshots. The route must
 * authenticate the actor and validate the combined semester before calling.
 */
export async function publishPostgresSyncDraft(args: {
  expectedDraftHash: string;
  expectedCoursesHash: string;
  expectedSchHash: string;
  actorId: string;
  actorName: string;
  reason: string;
  version: string;
}): Promise<{ published: true; backupVersion: string; coursesHash: string; schHash: string } | { published: false }> {
  if (!args.reason.trim() || !/^v\d{4}-\d{2}-\d{2}-\d{4}-\d{2}$/.test(args.version)) {
    throw new Error('A valid backup version and publish reason are required.');
  }
  return withPostgresTransaction(async client => {
    const active = await client.query<{ semester_key: string }>(
      'SELECT semester_key FROM planora.semesters WHERE is_active=true FOR UPDATE'
    );
    if (active.rowCount !== 1) throw new Error('PostgreSQL must contain exactly one active semester.');
    const semesterKey = active.rows[0].semester_key;
    const draftResult = await client.query<{ content: PostgresSyncDraft; content_sha256: string; run_id: string | null }>(
      'SELECT content, content_sha256, run_id FROM planora.sync_drafts WHERE semester_key=$1 FOR UPDATE',
      [semesterKey],
    );
    const draft = draftResult.rows[0];
    if (!draft || draft.content_sha256.trim() !== args.expectedDraftHash) return { published: false as const };
    const current = await client.query<{
      document_name: CatalogName; content: unknown; revision: number; content_sha256: string;
    }>(
      "SELECT document_name, content, revision, content_sha256 FROM planora.catalog_documents " +
      "WHERE semester_key=$1 AND state='published' AND document_name IN ('courses.json','sch.json') FOR UPDATE",
      [semesterKey],
    );
    const courses = current.rows.find(row => row.document_name === 'courses.json');
    const sch = current.rows.find(row => row.document_name === 'sch.json');
    if (!courses || !sch || courses.content_sha256.trim() !== args.expectedCoursesHash ||
        sch.content_sha256.trim() !== args.expectedSchHash) return { published: false as const };
    const nextCourses = JSON.stringify(draft.content.courses);
    const nextSch = JSON.stringify(draft.content.sch);
    const coursesHash = sha256(nextCourses);
    const schHash = sha256(nextSch);
    const backup = {
      semesterKey,
      version: args.version,
      createdAt: new Date().toISOString(),
      createdBy: args.actorName,
      reason: args.reason.trim().slice(0, 500),
      courses: courses.content,
      sch: sch.content,
    };
    await client.query(
      'INSERT INTO planora.sync_backups (semester_key, version, snapshot, created_by, reason) VALUES ($1,$2,$3::jsonb,$4,$5)',
      [semesterKey, args.version, JSON.stringify(backup), args.actorName, args.reason.trim().slice(0, 500)],
    );
    for (const item of [
      { name: 'courses.json' as const, content: nextCourses, hash: coursesHash, revision: courses.revision + 1 },
      { name: 'sch.json' as const, content: nextSch, hash: schHash, revision: sch.revision + 1 },
    ]) {
      await client.query(
        "UPDATE planora.catalog_documents SET content=$3::jsonb, content_sha256=$4, revision=$5, updated_by=$6, updated_at=now() " +
        "WHERE semester_key=$1 AND document_name=$2 AND state='published'",
        [semesterKey, item.name, item.content, item.hash, item.revision, args.actorId],
      );
      await client.query(
        "INSERT INTO planora.catalog_revisions (semester_key, document_name, revision, state, action, content, content_sha256, actor_id, actor_name, reason) " +
        "VALUES ($1,$2,$3,'published','sync_publish',$4::jsonb,$5,$6,$7,$8)",
        [semesterKey, item.name, item.revision, item.content, item.hash, args.actorId, args.actorName, args.reason.trim().slice(0, 500)],
      );
    }
    await client.query('DELETE FROM planora.sync_drafts WHERE semester_key=$1 AND content_sha256=$2', [semesterKey, args.expectedDraftHash]);
    if (draft.run_id) {
      await client.query(
        "UPDATE planora.sync_runs SET status='published', phase='published', completed_at=now() WHERE run_id=$1",
        [draft.run_id],
      );
    }
    await client.query(
      'INSERT INTO planora.admin_audit_events (actor_id, actor_name, action, metadata) VALUES ($1,$2,$3,$4::jsonb)',
      [args.actorId, args.actorName, 'sync_publish', JSON.stringify({ semesterKey, version: args.version, coursesHash, schHash, reason: args.reason })],
    );
    return { published: true as const, backupVersion: args.version, coursesHash, schHash };
  });
}


/** Restore a sync backup atomically, recording new immutable published revisions. */
export async function restorePostgresSyncBackup(args: {
  version: string;
  expectedCoursesHash: string;
  expectedSchHash: string;
  actorId: string;
  actorName: string;
  reason: string;
}): Promise<{ restored: true; coursesHash: string; schHash: string } | { restored: false }> {
  if (!/^v\d{4}-\d{2}-\d{2}-\d{4}-\d{2}$/.test(args.version) || !args.reason.trim()) {
    throw new Error('A valid backup version and restore reason are required.');
  }
  return withPostgresTransaction(async client => {
    const active = await client.query<{ semester_key: string }>(
      'SELECT semester_key FROM planora.semesters WHERE is_active=true FOR UPDATE'
    );
    if (active.rowCount !== 1) throw new Error('PostgreSQL must contain exactly one active semester.');
    const semesterKey = active.rows[0].semester_key;
    const backupResult = await client.query<{ snapshot: {
      courses: unknown[]; sch: unknown[]; version: string; semesterKey: string;
    } }>(
      'SELECT snapshot FROM planora.sync_backups WHERE semester_key=$1 AND version=$2',
      [semesterKey, args.version],
    );
    if (backupResult.rowCount !== 1) throw new Error('Requested sync backup does not exist.');
    const backup = backupResult.rows[0].snapshot;
    if (backup.semesterKey !== semesterKey || !Array.isArray(backup.courses) || !Array.isArray(backup.sch)) {
      throw new Error('Sync backup is invalid or belongs to a different semester.');
    }
    const currentResult = await client.query<{
      document_name: CatalogName; revision: number; content_sha256: string;
    }>(
      "SELECT document_name, revision, content_sha256 FROM planora.catalog_documents " +
      "WHERE semester_key=$1 AND state='published' AND document_name IN ('courses.json','sch.json') FOR UPDATE",
      [semesterKey],
    );
    const currentCourses = currentResult.rows.find(row => row.document_name === 'courses.json');
    const currentSch = currentResult.rows.find(row => row.document_name === 'sch.json');
    if (!currentCourses || !currentSch ||
        currentCourses.content_sha256.trim() !== args.expectedCoursesHash ||
        currentSch.content_sha256.trim() !== args.expectedSchHash) return { restored: false as const };
    const nextCourses = JSON.stringify(backup.courses);
    const nextSch = JSON.stringify(backup.sch);
    const coursesHash = sha256(nextCourses);
    const schHash = sha256(nextSch);
    for (const item of [
      { name: 'courses.json' as const, content: nextCourses, hash: coursesHash, revision: currentCourses.revision + 1 },
      { name: 'sch.json' as const, content: nextSch, hash: schHash, revision: currentSch.revision + 1 },
    ]) {
      await client.query(
        "UPDATE planora.catalog_documents SET content=$3::jsonb, content_sha256=$4, revision=$5, updated_by=$6, updated_at=now() " +
        "WHERE semester_key=$1 AND document_name=$2 AND state='published'",
        [semesterKey, item.name, item.content, item.hash, item.revision, args.actorId],
      );
      await client.query(
        "INSERT INTO planora.catalog_revisions (semester_key, document_name, revision, state, action, content, content_sha256, actor_id, actor_name, reason) " +
        "VALUES ($1,$2,$3,'published','sync_restore',$4::jsonb,$5,$6,$7,$8)",
        [semesterKey, item.name, item.revision, item.content, item.hash, args.actorId, args.actorName,
          ('Restore backup ' + args.version + ': ' + args.reason).slice(0, 500)],
      );
    }
    await client.query(
      'INSERT INTO planora.admin_audit_events (actor_id, actor_name, action, metadata) VALUES ($1,$2,$3,$4::jsonb)',
      [args.actorId, args.actorName, 'sync_restore', JSON.stringify({
        semesterKey, version: args.version, coursesHash, schHash, reason: args.reason.trim(),
      })],
    );
    return { restored: true as const, coursesHash, schHash };
  });
}


/** Discard only the sync draft whose hash the admin reviewed; live data is untouched. */
export async function discardPostgresSyncDraft(args: {
  expectedDraftHash: string;
  actorId: string;
  actorName: string;
  reason: string;
}): Promise<{ discarded: true } | { discarded: false }> {
  if (!args.reason.trim()) throw new Error('A discard reason is required.');
  return withPostgresTransaction(async client => {
    const active = await client.query<{ semester_key: string }>(
      'SELECT semester_key FROM planora.semesters WHERE is_active=true FOR UPDATE'
    );
    if (active.rowCount !== 1) throw new Error('PostgreSQL must contain exactly one active semester.');
    const semesterKey = active.rows[0].semester_key;
    const current = await client.query<{ content_sha256: string; source: string; run_id: string | null }>(
      'SELECT content_sha256, source, run_id FROM planora.sync_drafts WHERE semester_key=$1 FOR UPDATE',
      [semesterKey],
    );
    if (current.rowCount !== 1 || current.rows[0].content_sha256.trim() !== args.expectedDraftHash) {
      return { discarded: false as const };
    }
    await client.query('DELETE FROM planora.sync_drafts WHERE semester_key=$1 AND content_sha256=$2', [
      semesterKey, args.expectedDraftHash,
    ]);
    if (current.rows[0].run_id) {
      await client.query(
        "UPDATE planora.sync_runs SET status='rejected', phase='draft_discarded', error_summary=$2, completed_at=now() WHERE run_id=$1",
        [current.rows[0].run_id, args.reason.trim().slice(0, 500)],
      );
    } else {
      await client.query(
        "INSERT INTO planora.sync_runs (source, status, phase, counts, warnings, error_summary, started_at, completed_at) " +
        "VALUES ($1,'rejected','draft_discarded','{}'::jsonb,'[]'::jsonb,$2,now(),now())",
        [current.rows[0].source, args.reason.trim().slice(0, 500)],
      );
    }
    await client.query(
      'INSERT INTO planora.admin_audit_events (actor_id, actor_name, action, metadata) VALUES ($1,$2,$3,$4::jsonb)',
      [args.actorId, args.actorName, 'sync_discard', JSON.stringify({
        semesterKey, source: current.rows[0].source, contentSha256: args.expectedDraftHash,
        reason: args.reason.trim().slice(0, 500),
      })],
    );
    return { discarded: true as const };
  });
}

/** List bounded backup metadata without transferring full catalog snapshots. */
export async function listPostgresSyncBackups(page = 0, pageSize = 20): Promise<{
  entries: Array<{ version: string; createdBy: string | null; reason: string; createdAt: string }>;
  page: number;
  pageSize: number;
}> {
  const { postgresPool, activeSemesterKey } = await import('./postgres-store');
  const safePage = Number.isSafeInteger(page) ? Math.max(0, Math.min(1000, page)) : 0;
  const safeSize = Number.isSafeInteger(pageSize) ? Math.max(1, Math.min(100, pageSize)) : 20;
  const semesterKey = await activeSemesterKey();
  const result = await postgresPool().query<{
    version: string; created_by: string | null; reason: string; created_at: Date | string;
  }>(
    'SELECT version, created_by, reason, created_at FROM planora.sync_backups ' +
    'WHERE semester_key=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3',
    [semesterKey, safePage * safeSize, safeSize],
  );
  return {
    page: safePage, pageSize: safeSize,
    entries: result.rows.map(row => ({
      version: row.version, createdBy: row.created_by, reason: row.reason,
      createdAt: (row.created_at instanceof Date ? row.created_at : new Date(row.created_at)).toISOString(),
    })),
  };
}

/** Fetch one backup only after its exact version is selected by an authenticated admin. */
export async function readPostgresSyncBackup(version: string): Promise<unknown | null> {
  if (!/^v\\d{4}-\\d{2}-\\d{2}-\\d{4}-\\d{2}$/.test(version)) {
    throw new Error('Invalid sync backup version.');
  }
  const { postgresPool, activeSemesterKey } = await import('./postgres-store');
  const semesterKey = await activeSemesterKey();
  const result = await postgresPool().query<{ snapshot: unknown }>(
    'SELECT snapshot FROM planora.sync_backups WHERE semester_key=$1 AND version=$2',
    [semesterKey, version],
  );
  return result.rowCount === 1 ? result.rows[0].snapshot : null;
}
