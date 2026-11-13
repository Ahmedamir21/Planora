import { activeSemesterKey, postgresPool } from '../api/postgres-store';

export type CatalogRevisionEntry = {
  revision: number;
  state: 'published' | 'draft';
  action: string;
  contentSha256: string;
  actorId: string | null;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
};

export type AdminAuditEntry = {
  actorId: string | null;
  actorName: string | null;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

const DOCUMENTS = ['semester.json', 'courses.json', 'majors.json', 'sch.json'] as const;
type DocumentName = typeof DOCUMENTS[number];

function pagination(pageValue: unknown, sizeValue: unknown) {
  const page = Number.isSafeInteger(pageValue) ? Math.max(0, Math.min(1000, pageValue as number)) : 0;
  const pageSize = Number.isSafeInteger(sizeValue) ? Math.max(1, Math.min(100, sizeValue as number)) : 20;
  return { page, pageSize, offset: page * pageSize };
}

/** Read-only revision history. Document bodies are deliberately not returned. */
export async function listPostgresRevisions(args: {
  documentName: DocumentName;
  state?: 'published' | 'draft';
  page?: number;
  pageSize?: number;
}): Promise<{ entries: CatalogRevisionEntry[]; page: number; pageSize: number }> {
  if (!DOCUMENTS.includes(args.documentName)) throw new Error('Unknown catalog document.');
  const { page, pageSize, offset } = pagination(args.page, args.pageSize);
  const semesterKey = await activeSemesterKey();
  const result = args.state
    ? await postgresPool().query<{
        revision: number; state: 'published' | 'draft'; action: string; content_sha256: string;
        actor_id: string | null; actor_name: string | null; reason: string | null; created_at: Date | string;
      }>(
        'SELECT revision, state, action, content_sha256, actor_id, actor_name, reason, created_at ' +
        'FROM planora.catalog_revisions WHERE semester_key=$1 AND document_name=$2 AND state=$3 ' +
        'ORDER BY created_at DESC, revision DESC OFFSET $4 LIMIT $5',
        [semesterKey, args.documentName, args.state, offset, pageSize],
      )
    : await postgresPool().query<{
        revision: number; state: 'published' | 'draft'; action: string; content_sha256: string;
        actor_id: string | null; actor_name: string | null; reason: string | null; created_at: Date | string;
      }>(
        'SELECT revision, state, action, content_sha256, actor_id, actor_name, reason, created_at ' +
        'FROM planora.catalog_revisions WHERE semester_key=$1 AND document_name=$2 ' +
        'ORDER BY created_at DESC, revision DESC OFFSET $3 LIMIT $4',
        [semesterKey, args.documentName, offset, pageSize],
      );
  return {
    page, pageSize,
    entries: result.rows.map(row => ({
      revision: row.revision, state: row.state, action: row.action,
      contentSha256: row.content_sha256.trim(), actorId: row.actor_id,
      actorName: row.actor_name, reason: row.reason,
      createdAt: (row.created_at instanceof Date ? row.created_at : new Date(row.created_at)).toISOString(),
    })),
  };
}

/** Read-only, bounded audit feed for the authenticated admin UI. */
export async function listPostgresAuditEvents(args: {
  page?: number;
  pageSize?: number;
} = {}): Promise<{ entries: AdminAuditEntry[]; page: number; pageSize: number }> {
  const { page, pageSize, offset } = pagination(args.page, args.pageSize);
  const result = await postgresPool().query<{
    actor_id: string | null; actor_name: string | null; action: string;
    metadata: Record<string, unknown>; created_at: Date | string;
  }>(
    'SELECT actor_id, actor_name, action, metadata, created_at FROM planora.admin_audit_events ' +
    'ORDER BY created_at DESC, event_id DESC OFFSET $1 LIMIT $2',
    [offset, pageSize],
  );
  return {
    page, pageSize,
    entries: result.rows.map(row => ({
      actorId: row.actor_id, actorName: row.actor_name, action: row.action,
      metadata: row.metadata,
      createdAt: (row.created_at instanceof Date ? row.created_at : new Date(row.created_at)).toISOString(),
    })),
  };
}

/** Fetch the exact immutable revision body for server-side validation before restore. */
export async function readPostgresRevisionContent(args: {
  documentName: DocumentName;
  state: 'published' | 'draft';
  revision: number;
}): Promise<string | null> {
  if (!DOCUMENTS.includes(args.documentName) || !Number.isSafeInteger(args.revision) || args.revision < 1) {
    throw new Error('Invalid catalog revision request.');
  }
  const semesterKey = await activeSemesterKey();
  const result = await postgresPool().query<{ content: unknown }>(
    'SELECT content FROM planora.catalog_revisions WHERE semester_key=$1 AND document_name=$2 AND state=$3 AND revision=$4 LIMIT 1',
    [semesterKey, args.documentName, args.state, args.revision],
  );
  if (result.rowCount !== 1) return null;
  return JSON.stringify(result.rows[0].content);
}
