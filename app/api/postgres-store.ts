/**
 * PostgreSQL runtime primitives for the staged Planora cutover.
 *
 * Deliberately not wired into handlers yet: catalog, admin, and sync routes must
 * move together before PLANORA_STORAGE_BACKEND=postgres can be enabled. Never
 * silently fall back to Redis when PostgreSQL is selected.
 */
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

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
 * Returns the JSON document as a serialized string to preserve the existing
 * API's string-based editor contract. The caller should hash this exact string
 * for its optimistic-concurrency token rather than trusting a JSONB text hash.
 */
export async function readCatalogDocument(
  documentName: 'semester.json' | 'courses.json' | 'majors.json' | 'sch.json',
  state: 'published' | 'draft' = 'published',
): Promise<{ content: string; revision: number; updatedAt: string } | null> {
  const semesterKey = await activeSemesterKey();
  const result = await postgresPool().query<{
    content: unknown;
    revision: number;
    updated_at: Date | string;
  }>(
    'SELECT content, revision, updated_at FROM planora.catalog_documents WHERE semester_key = $1 AND document_name = $2 AND state = $3',
    [semesterKey, documentName, state],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  const content = JSON.stringify(row.content);
  if (typeof content !== 'string') throw new Error('Stored catalog document is not serializable JSON.');
  return { content, revision: row.revision, updatedAt: new Date(row.updated_at).toISOString() };
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

/** Keep unused generic type imports out of emitted JS while documenting row intent. */
type _RowShape = QueryResultRow;
void (0 as unknown as _RowShape);
