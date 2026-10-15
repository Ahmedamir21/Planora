/**
 * PostgreSQL runtime primitives for the staged Planora cutover.
 *
 * Deliberately not wired into handlers yet: catalog, admin, and sync routes must
 * move together before PLANORA_STORAGE_BACKEND=postgres can be enabled. Never
 * silently fall back to Redis when PostgreSQL is selected.
 */
import { Pool, type PoolClient } from 'pg';
import { createHash } from 'node:crypto';

type PlanoraPool = Pool & { __planoraPool?: true };
const globalPool = globalThis as typeof globalThis & { __planoraPostgresPool?: PlanoraPool };

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error('PostgreSQL storage is selected but DATABASE_URL is not configured.');
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error('DATABASE_URL is not a valid PostgreSQL connection URL.'); }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgres:// or postgresql:// scheme.');
  }
  return value;
}

/** Explicit opt-in only; the default remains the existing Redis backend. */
export function postgresRuntimeSelected() {
  return process.env.PLANORA_STORAGE_BACKEND === 'postgres';
}

export function postgresConfigured() {
  return !!process.env.DATABASE_URL?.trim();
}

export function postgresPool(): Pool {
  if (!postgresRuntimeSelected()) throw new Error('PostgreSQL runtime is not enabled.');
  if (globalPool.__planoraPostgresPool) return globalPool.__planoraPostgresPool;
  const pool = new Pool({
    connectionString: databaseUrl(),
    max: 3,
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: 5_000,
    query_timeout: 10_000,
    application_name: 'planora-vercel-api',
    // TLS verification is left to the driver's normal connection URL settings;
    // never disable certificate verification in application code.
  }) as PlanoraPool;
  pool.on('error', () => {
    // Do not log connection strings or driver errors that may contain secrets.
    console.error('Planora PostgreSQL pool encountered an idle-client error.');
  });
  pool.__planoraPool = true;
  globalPool.__planoraPostgresPool = pool;
  return pool;
}

export async function withPostgresTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await postgresPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '8s'");
    await client.query("SET LOCAL lock_timeout = '3s'");
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function activeSemesterKey(client?: PoolClient): Promise<string> {
  const executor = client || postgresPool();
  const result = await executor.query<{ semester_key: string }>(
    'SELECT semester_key FROM planora.semesters WHERE is_active = true'
  );
  if (result.rowCount !== 1) throw new Error('PostgreSQL must contain exactly one active Planora semester.');
  return result.rows[0].semester_key;
}

/**
 * Returns the JSON document plus its database-managed content hash. Because JSONB
 * normalizes representation, callers must use contentSha256 (not hash(content))
 * as the PostgreSQL optimistic-concurrency token.
 */
export async function readCatalogDocument(
  documentName: 'semester.json' | 'courses.json' | 'majors.json' | 'sch.json',
  state: 'published' | 'draft' = 'published',
): Promise<{ content: string; revision: number; contentSha256: string; updatedAt: string } | null> {
  const semesterKey = await activeSemesterKey();
  const result = await postgresPool().query<{
    content: unknown;
    revision: number;
    content_sha256: string;
    updated_at: Date | string;
  }>(
    'SELECT content, revision, content_sha256, updated_at FROM planora.catalog_documents WHERE semester_key = $1 AND document_name = $2 AND state = $3',
    [semesterKey, documentName, state],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  const content = JSON.stringify(row.content);
  if (typeof content !== 'string') throw new Error('Stored catalog document is not serializable JSON.');
  const updatedAt = row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at);
  return { content, revision: row.revision, contentSha256: row.content_sha256.trim(), updatedAt: updatedAt.toISOString() };
}


/**
 * Saves a draft and its immutable revision/audit event atomically.
 * expectedHash is the content_sha256 returned by readCatalogDocument, or '' if
 * no draft exists. The caller remains responsible for authorization and dataset
 * validation before calling this persistence primitive.
 */
export async function savePostgresDraft(args: {
  documentName: 'semester.json' | 'courses.json' | 'majors.json' | 'sch.json';
  content: string;
  expectedHash: string;
  actorId: string;
  actorName: string;
  reason?: string;
}): Promise<{ saved: true; revision: number; contentSha256: string } | { saved: false }> {
  let parsed: unknown;
  try { parsed = JSON.parse(args.content); } catch { throw new Error('Draft content must be valid JSON.'); }
  const contentSha256 = createHash('sha256').update(args.content).digest('hex');
  return withPostgresTransaction(async client => {
    // Serialize first-draft creation too; SELECT ... FOR UPDATE on a missing draft
    // row alone cannot prevent two concurrent first saves from racing.
    const active = await client.query<{ semester_key: string }>(
      'SELECT semester_key FROM planora.semesters WHERE is_active = true FOR UPDATE'
    );
    if (active.rowCount !== 1) throw new Error('PostgreSQL must contain exactly one active Planora semester.');
    const semesterKey = active.rows[0].semester_key;
    const current = await client.query<{ revision: number; content_sha256: string }>(
      "SELECT revision, content_sha256 FROM planora.catalog_documents WHERE semester_key=$1 AND document_name=$2 AND state='draft' FOR UPDATE",
      [semesterKey, args.documentName],
    );
    const actualHash = current.rowCount ? current.rows[0].content_sha256.trim() : '';
    if (actualHash !== args.expectedHash) return { saved: false as const };
    const revision = current.rowCount ? current.rows[0].revision + 1 : 1;
    await client.query(
      "INSERT INTO planora.catalog_documents (semester_key, document_name, state, content, content_sha256, revision, updated_by) " +
      "VALUES ($1,$2,'draft',$3::jsonb,$4,$5,$6) " +
      "ON CONFLICT (semester_key, document_name, state) DO UPDATE SET content=EXCLUDED.content, content_sha256=EXCLUDED.content_sha256, revision=EXCLUDED.revision, updated_by=EXCLUDED.updated_by, updated_at=now()",
      [semesterKey, args.documentName, JSON.stringify(parsed), contentSha256, revision, args.actorId],
    );
    await client.query(
      "INSERT INTO planora.catalog_revisions (semester_key, document_name, revision, state, action, content, content_sha256, actor_id, actor_name, reason) " +
      "VALUES ($1,$2,$3,'draft','save_draft',$4::jsonb,$5,$6,$7,$8)",
      [semesterKey, args.documentName, revision, JSON.stringify(parsed), contentSha256, args.actorId, args.actorName, (args.reason || '').slice(0, 500)],
    );
    await client.query(
      'INSERT INTO planora.admin_audit_events (actor_id, actor_name, action, metadata) VALUES ($1,$2,$3,$4::jsonb)',
      [args.actorId, args.actorName, 'save_draft', JSON.stringify({ semesterKey, documentName: args.documentName, revision, contentSha256 })],
    );
    return { saved: true as const, revision, contentSha256 };
  });
}


/**
 * Publishes a reviewed draft only if both the draft and current published
 * snapshot still match the editor's observed hashes. Call only after the route
 * has authenticated the admin and validated the complete combined dataset.
 */
export async function publishPostgresDraft(args: {
  documentName: 'semester.json' | 'courses.json' | 'majors.json' | 'sch.json';
  expectedDraftHash: string;
  expectedPublishedHash: string;
  actorId: string;
  actorName: string;
  reason?: string;
}): Promise<{ published: true; revision: number; contentSha256: string } | { published: false }> {
  return withPostgresTransaction(async client => {
    const active = await client.query<{ semester_key: string }>(
      'SELECT semester_key FROM planora.semesters WHERE is_active = true FOR UPDATE'
    );
    if (active.rowCount !== 1) throw new Error('PostgreSQL must contain exactly one active Planora semester.');
    const semesterKey = active.rows[0].semester_key;
    const docs = await client.query<{
      state: 'draft' | 'published';
      content: unknown;
      revision: number;
      content_sha256: string;
    }>(
      "SELECT state, content, revision, content_sha256 FROM planora.catalog_documents " +
      "WHERE semester_key=$1 AND document_name=$2 AND state IN ('draft','published') FOR UPDATE",
      [semesterKey, args.documentName],
    );
    const draft = docs.rows.find(row => row.state === 'draft');
    const published = docs.rows.find(row => row.state === 'published');
    if (!draft || !published ||
        draft.content_sha256.trim() !== args.expectedDraftHash ||
        published.content_sha256.trim() !== args.expectedPublishedHash) return { published: false as const };

    const content = JSON.stringify(draft.content);
    const contentSha256 = draft.content_sha256.trim();
    const revision = published.revision + 1;
    await client.query(
      "UPDATE planora.catalog_documents SET content=$3::jsonb, content_sha256=$4, revision=$5, updated_by=$6, updated_at=now() " +
      "WHERE semester_key=$1 AND document_name=$2 AND state='published'",
      [semesterKey, args.documentName, content, contentSha256, revision, args.actorId],
    );
    await client.query(
      "INSERT INTO planora.catalog_revisions (semester_key, document_name, revision, state, action, content, content_sha256, actor_id, actor_name, reason) " +
      "VALUES ($1,$2,$3,'published','publish',$4::jsonb,$5,$6,$7,$8)",
      [semesterKey, args.documentName, revision, content, contentSha256, args.actorId, args.actorName, (args.reason || '').slice(0, 500)],
    );
    await client.query(
      'DELETE FROM planora.catalog_documents WHERE semester_key=$1 AND document_name=$2 AND state=\'draft\' AND content_sha256=$3',
      [semesterKey, args.documentName, contentSha256],
    );
    await client.query(
      'INSERT INTO planora.admin_audit_events (actor_id, actor_name, action, metadata) VALUES ($1,$2,$3,$4::jsonb)',
      [args.actorId, args.actorName, 'publish', JSON.stringify({ semesterKey, documentName: args.documentName, revision, contentSha256 })],
    );
    return { published: true as const, revision, contentSha256 };
  });
}


/** Restores a historical published revision as a new revision; history is never rewritten. */
export async function restorePostgresRevision(args: {
  documentName: 'semester.json' | 'courses.json' | 'majors.json' | 'sch.json';
  sourceRevision: number;
  expectedPublishedHash: string;
  actorId: string;
  actorName: string;
  reason?: string;
}): Promise<{ restored: true; revision: number; contentSha256: string } | { restored: false }> {
  if (!Number.isSafeInteger(args.sourceRevision) || args.sourceRevision < 1) {
    throw new Error('A positive historical revision number is required.');
  }
  return withPostgresTransaction(async client => {
    const active = await client.query<{ semester_key: string }>(
      'SELECT semester_key FROM planora.semesters WHERE is_active = true FOR UPDATE'
    );
    if (active.rowCount !== 1) throw new Error('PostgreSQL must contain exactly one active Planora semester.');
    const semesterKey = active.rows[0].semester_key;
    const current = await client.query<{ revision: number; content_sha256: string }>(
      "SELECT revision, content_sha256 FROM planora.catalog_documents " +
      "WHERE semester_key=$1 AND document_name=$2 AND state='published' FOR UPDATE",
      [semesterKey, args.documentName],
    );
    if (current.rowCount !== 1 || current.rows[0].content_sha256.trim() !== args.expectedPublishedHash) {
      return { restored: false as const };
    }
    const source = await client.query<{ content: unknown; content_sha256: string }>(
      "SELECT content, content_sha256 FROM planora.catalog_revisions " +
      "WHERE semester_key=$1 AND document_name=$2 AND state='published' AND revision=$3",
      [semesterKey, args.documentName, args.sourceRevision],
    );
    if (source.rowCount !== 1) throw new Error('Requested published revision does not exist.');
    const content = JSON.stringify(source.rows[0].content);
    const contentSha256 = source.rows[0].content_sha256.trim();
    const revision = current.rows[0].revision + 1;
    await client.query(
      "UPDATE planora.catalog_documents SET content=$3::jsonb, content_sha256=$4, revision=$5, updated_by=$6, updated_at=now() " +
      "WHERE semester_key=$1 AND document_name=$2 AND state='published'",
      [semesterKey, args.documentName, content, contentSha256, revision, args.actorId],
    );
    await client.query(
      "INSERT INTO planora.catalog_revisions (semester_key, document_name, revision, state, action, content, content_sha256, actor_id, actor_name, reason) " +
      "VALUES ($1,$2,$3,'published','restore',$4::jsonb,$5,$6,$7,$8)",
      [semesterKey, args.documentName, revision, content, contentSha256, args.actorId, args.actorName,
        ('Restore revision ' + args.sourceRevision + (args.reason ? ': ' + args.reason : '')).slice(0, 500)],
    );
    await client.query(
      'INSERT INTO planora.admin_audit_events (actor_id, actor_name, action, metadata) VALUES ($1,$2,$3,$4::jsonb)',
      [args.actorId, args.actorName, 'restore', JSON.stringify({
        semesterKey, documentName: args.documentName, sourceRevision: args.sourceRevision, revision, contentSha256,
      })],
    );
    return { restored: true as const, revision, contentSha256 };
  });
}

/** Parameterized, read-only diagnostic for a deploy health endpoint or CLI. */
export async function postgresReadiness(): Promise<{
  ready: boolean;
  activeSemester: string | null;
  publishedDocuments: number;
  draftDocuments: number;
}> {
  const result = await postgresPool().query<{
    semester_key: string;
    published_documents: number;
    draft_documents: number;
  }>(
    'SELECT s.semester_key, ' +
      "count(*) FILTER (WHERE d.state = 'published')::int AS published_documents, " +
      "count(*) FILTER (WHERE d.state = 'draft')::int AS draft_documents " +
      'FROM planora.semesters s LEFT JOIN planora.catalog_documents d ON d.semester_key = s.semester_key ' +
      'WHERE s.is_active = true GROUP BY s.semester_key',
  );
  if (result.rowCount !== 1) return { ready: false, activeSemester: null, publishedDocuments: 0, draftDocuments: 0 };
  const row = result.rows[0];
  return {
    ready: row.published_documents === 4,
    activeSemester: row.semester_key,
    publishedDocuments: row.published_documents,
    draftDocuments: row.draft_documents,
  };
}
