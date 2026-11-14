import { redis, HISTORY_KEY, draftKey, liveKey } from '../api/admin-store';
import { isCatalogFile } from '../api/catalog';
import { REPORTS_DATA, REPORTS_KEY } from '../api/reports';
import { REPORT_EMAIL_STATUS } from '../api/report-email';
import { FEEDBACK_DATA, FEEDBACK_IDS, feedbackSummary, type Feedback } from '../api/feedback';
import { SECURITY_KEY } from '../api/admin-security';
import { SYNC_BACKUPS_KEY, SYNC_DRAFT_KEY, SYNC_STATUS_KEY, syncBackupKey } from '../api/sync-store';
import { sha } from './admin-session';
import { FILES, allowedFile, published } from './admin-dataset';
import type { Admin } from './admin-types';

// Everything an admin can read with a GET request.
export async function handleRead(req: any, res: any, admin: Admin) {
  const action = req.query?.action;
  if (action === 'reports') {
    const rawIds = await redis(['LRANGE', REPORTS_KEY, 0, 499]);
    const rows = rawIds?.length ? await redis(['HMGET', REPORTS_DATA, ...rawIds]) : [];
    const emailStatuses = rawIds?.length ? await redis(['HMGET', REPORT_EMAIL_STATUS, ...rawIds]) : [];
    const reports = (rows || []).map((row: string | null, index: number) => row ? { ...JSON.parse(row), emailStatus: emailStatuses?.[index] || 'not configured' } : null).filter(Boolean);
    return res.status(200).json({ reports, newCount: reports.filter((item: any) => item.status === 'new').length });
  }
  if (action === 'feedback') {
    const ids = await redis(['LRANGE', FEEDBACK_IDS, 0, 499]);
    const raw = ids?.length ? await redis(['HMGET', FEEDBACK_DATA, ...ids]) : [];
    const items: Feedback[] = (raw || []).filter(Boolean).map((row: string) => JSON.parse(row));
    return res.status(200).json({ items, summary: feedbackSummary(items) });
  }
  if (action === 'history') {
    const page = Math.min(100, Math.max(0, Number(req.query?.page) || 0));
    const raw = await redis(['LRANGE', HISTORY_KEY, page * 20, page * 20 + 19]);
    return res.status(200).json({ entries: (raw || []).map((row: string) => JSON.parse(row)) });
  }
  if (action === 'security') {
    const raw = await redis(['LRANGE', SECURITY_KEY, 0, 199]);
    return res.status(200).json({ entries: (raw || []).map((row: string) => JSON.parse(row)) });
  }
  if (action === 'sync_status') {
    const [rawStatus, rawDraft, backups] = await Promise.all([
      redis(['GET', SYNC_STATUS_KEY]), redis(['GET', SYNC_DRAFT_KEY]), redis(['LRANGE', SYNC_BACKUPS_KEY, 0, 19]),
    ]);
    const draft = rawDraft ? JSON.parse(rawDraft) : null;
    return res.status(200).json({
      status: rawStatus ? JSON.parse(rawStatus) : { state: 'Not run', phase: 'idle' },
      draft: draft ? { ...draft, courses: undefined, sch: undefined } : null,
      draftRevision: rawDraft ? sha(rawDraft) : '',
      backups: backups || [],
    });
  }
  if (action === 'sync_backup') {
    const version = typeof req.query?.version === 'string' ? req.query.version : '';
    if (!/^v\d{4}-\d{2}-\d{2}-\d{4}(?:-\d{2})?$/.test(version)) return res.status(400).json({ error: 'Invalid backup version.' });
    const backup = await redis(['GET', syncBackupKey(version)]);
    if (!backup) return res.status(404).json({ error: 'Backup not found.' });
    return res.status(200).json({ backup: JSON.parse(backup) });
  }
  if (action === 'draft') {
    if (!allowedFile(req.query?.file)) return res.status(400).json({ error: 'Invalid filename.' });
    const content = await redis(['GET', draftKey(req.query.file)]);
    return res.status(200).json({ content, revision: content == null ? '' : sha(content) });
  }
  if (action === 'live') {
    if (!allowedFile(req.query?.file)) return res.status(400).json({ error: 'Invalid filename.' });
    const content = isCatalogFile(req.query.file) ? await redis(['GET', liveKey(req.query.file)]) : null;
    const current = content ?? JSON.stringify(published[req.query.file as typeof FILES[number]]);
    return res.status(200).json({ content: current, revision: sha(current) });
  }
  return res.status(200).json({ authenticated: true, user: { id: admin.id, name: admin.name } });
}
