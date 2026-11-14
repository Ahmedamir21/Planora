import { redis, HISTORY_KEY } from '../api/admin-store';
import { validateDataset } from '../dataset-validation.cjs';
import { SYNC_DRAFT_KEY, SYNC_STATUS_KEY, discardSyncDraft, publishSyncDraft, restoreSyncBackup, stageSyncDraft, syncBackupKey } from '../api/sync-store';
import { sha } from './admin-session';
import { effectiveCatalog, publishedMajors, publishedSemester } from './admin-dataset';
import { changes, event } from './admin-events';
import { syncChangeSummary, syncCounts, syncStatus } from './sync-summary';
import { NOT_HANDLED, type Admin } from './admin-types';

// Self-Service sync actions: stage, discard, publish and restore.
export async function handleSync(body: any, admin: Admin, res: any) {
  if (body.action === 'sync_stage') {
    const source = typeof body.source === 'string' ? body.source.trim().slice(0, 240) : '';
    const expectedRevision = typeof body.expectedSyncRevision === 'string' ? body.expectedSyncRevision : '';
    const dataset = body.dataset && typeof body.dataset === 'object' ? body.dataset : null;
    if (!source || !dataset || !Array.isArray(dataset.courses) || !Array.isArray(dataset.sch)) return res.status(400).json({ error: 'Add the fetched courses, SCH data, and a source label.' });
    const previous = await redis(['GET', SYNC_DRAFT_KEY]) || '';
    if ((previous ? sha(previous) : '') !== expectedRevision) return res.status(409).json({ error: 'The sync draft changed. Refresh Self-Service Sync before staging again.' });
    const check = validateDataset({ semester: publishedSemester, majors: publishedMajors, courses: dataset.courses, sch: dataset.sch });
    if (check.errors.length) {
      const failedAt = new Date().toISOString();
      const counts = syncCounts(dataset.courses, dataset.sch);
      const status = syncStatus({ state: 'Failed', phase: 'validation_failed', startedAt: typeof body.startedAt === 'string' ? body.startedAt : failedAt, finishedAt: failedAt, source, ...counts, errors: check.errors.length, warnings: check.warnings.length });
      await redis(['SET', SYNC_STATUS_KEY, status]);
      await redis(['LPUSH', HISTORY_KEY, event(admin, 'sync_rejected', { source, changed: check.errors.slice(0, 10), method: 'Fetched data rejected before Draft; live data unchanged' })]);
      return res.status(400).json({ error: `Fetched data has ${check.errors.length} blocking validation errors. Live data was not changed.`, errors: check.errors.slice(0, 30) });
    }
    const live = await effectiveCatalog();
    const diff = syncChangeSummary(live.courses, live.sch, dataset.courses, dataset.sch);
    const warnings = [...check.warnings];
    const sectionBase = Math.max(1, diff.previousSections);
    if (Math.abs(diff.sectionDelta) > Math.max(20, Math.ceil(sectionBase * 0.25))) warnings.unshift(`Large section-count change: ${diff.previousSections} → ${diff.sections}. Review before publishing.`);
    if (diff.addedCourses || diff.removedCourses) warnings.unshift(`Course set changed: +${diff.addedCourses} / -${diff.removedCourses}. Review course mapping before publishing.`);
    const now = new Date().toISOString();
    const payload = JSON.stringify({
      source, fetchedAt: typeof body.fetchedAt === 'string' ? body.fetchedAt : now, stagedAt: now,
      courses: dataset.courses, sch: dataset.sch, validation: { warnings, summary: check.summary }, changes: diff,
    });
    const state = warnings.length ? 'Warning' : 'Success';
    const status = syncStatus({ state, phase: 'draft_ready', startedAt: typeof body.startedAt === 'string' ? body.startedAt : now, finishedAt: now, source, ...syncCounts(dataset.courses, dataset.sch), warnings: warnings.length });
    const log = event(admin, 'sync_stage', { source, changed: [`${diff.changedCourses} changed courses`, `${diff.addedCourses} added`, `${diff.removedCourses} removed`, `${diff.sectionDelta >= 0 ? '+' : ''}${diff.sectionDelta} sections`], method: 'Self-Service Sync draft only' });
    if (await stageSyncDraft(previous, payload, status, log) !== 1) return res.status(409).json({ error: 'The sync draft changed while staging. Refresh and retry.' });
    return res.status(200).json({ draftRevision: sha(payload), state, warnings, changes: diff, summary: check.summary });
  }
  if (body.action === 'sync_discard') {
    const previous = await redis(['GET', SYNC_DRAFT_KEY]) || '';
    const expectedRevision = typeof body.expectedSyncRevision === 'string' ? body.expectedSyncRevision : '';
    if (!previous) return res.status(400).json({ error: 'There is no Self-Service sync draft to discard.' });
    if (sha(previous) !== expectedRevision) return res.status(409).json({ error: 'The sync draft changed. Refresh before discarding it.' });
    const status = syncStatus({ state: 'Success', phase: 'discarded', finishedAt: new Date().toISOString() });
    const log = event(admin, 'sync_discard', { method: 'Discard fetched draft; live data unchanged' });
    if (await discardSyncDraft(previous, status, log) !== 1) return res.status(409).json({ error: 'The sync draft changed. Refresh and retry.' });
    return res.status(200).json({ discarded: true });
  }
  if (body.action === 'sync_publish') {
    const previous = await redis(['GET', SYNC_DRAFT_KEY]) || '';
    const expectedRevision = typeof body.expectedSyncRevision === 'string' ? body.expectedSyncRevision : '';
    const reason = typeof body.source === 'string' ? body.source.trim().slice(0, 240) : '';
    if (!previous || sha(previous) !== expectedRevision) return res.status(409).json({ error: 'Reload the latest Self-Service sync draft before publishing.' });
    if (!reason) return res.status(400).json({ error: 'Add what you verified before publishing this draft.' });
    const draft = JSON.parse(previous);
    const check = validateDataset({ semester: publishedSemester, majors: publishedMajors, courses: draft.courses, sch: draft.sch });
    if (check.errors.length) return res.status(400).json({ error: `Draft has ${check.errors.length} blocking errors.`, errors: check.errors.slice(0, 30) });
    const live = await effectiveCatalog();
    const now = new Date();
    const version = `v${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}-${String(now.getUTCHours()).padStart(2,'0')}${String(now.getUTCMinutes()).padStart(2,'0')}-${String(now.getUTCSeconds()).padStart(2,'0')}`;
    const backup = JSON.stringify({ version, createdAt: now.toISOString(), createdBy: admin.name, semester: publishedSemester, majors: publishedMajors, courses: live.courses, sch: live.sch });
    const status = syncStatus({ state: 'Success', phase: 'published', finishedAt: now.toISOString(), source: draft.source, publishedBy: admin.name, backupVersion: version, ...syncCounts(draft.courses, draft.sch), warnings: check.warnings.length });
    const log = event(admin, 'sync_publish', { source: reason, backupVersion: version, changed: changes(JSON.stringify([...live.courses, ...live.sch]), JSON.stringify([...draft.courses, ...draft.sch])), method: 'Validated Self-Service draft → live catalog' });
    const result = await publishSyncDraft({ expectedDraft: previous, expectedCoursesOverride: live.coursesOverride, expectedSchOverride: live.schOverride, backupKey: syncBackupKey(version), backup, version, courses: JSON.stringify(draft.courses), sch: JSON.stringify(draft.sch), status, history: log });
    if (result !== 1) return res.status(409).json({ error: 'Live data or the sync draft changed. Nothing was published; refresh and review again.' });
    return res.status(200).json({ published: true, backupVersion: version });
  }
  if (body.action === 'sync_restore') {
    const version = typeof body.version === 'string' ? body.version : '';
    const reason = typeof body.source === 'string' ? body.source.trim().slice(0, 240) : '';
    if (!/^v\d{4}-\d{2}-\d{2}-\d{4}-\d{2}$/.test(version) || !reason) return res.status(400).json({ error: 'Choose a backup and add a restore reason.' });
    const rawBackup = await redis(['GET', syncBackupKey(version)]);
    if (!rawBackup) return res.status(404).json({ error: 'Backup not found.' });
    const backup = JSON.parse(rawBackup);
    const check = validateDataset({ semester: backup.semester, majors: backup.majors, courses: backup.courses, sch: backup.sch });
    if (check.errors.length) return res.status(400).json({ error: 'This backup failed validation and was not restored.', errors: check.errors.slice(0, 30) });
    const live = await effectiveCatalog();
    const status = syncStatus({ state: 'Success', phase: 'restored', finishedAt: new Date().toISOString(), restoredVersion: version, restoredBy: admin.name });
    const log = event(admin, 'sync_restore', { source: reason, backupVersion: version, method: 'Restore versioned Self-Service catalog backup' });
    if (await restoreSyncBackup({ expectedCoursesOverride: live.coursesOverride, expectedSchOverride: live.schOverride, courses: JSON.stringify(backup.courses), sch: JSON.stringify(backup.sch), status, history: log }) !== 1) return res.status(409).json({ error: 'Live data changed while restoring. Nothing was restored; refresh and retry.' });
    return res.status(200).json({ restored: true, version });
  }
  return NOT_HANDLED;
}
