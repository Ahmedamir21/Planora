import { redis, HISTORY_KEY, draftKey, liveKey, saveLive, undoLive, saveWithHistory, undoWithHistory } from '../api/admin-store';
import { isCatalogFile } from '../api/catalog';
import { validateDataset } from '../dataset-validation.cjs';
import { sha } from './admin-session';
import { allowedFile, combinedDataset, published, publishedMajors, publishedSemester } from './admin-dataset';
import { validData } from './admin-validation';
import { changes, event } from './admin-events';
import { NOT_HANDLED, type Admin } from './admin-types';

// Dataset actions: validate, undo, save, publish and export.
export async function handleDataset(body: any, admin: Admin, res: any) {
  if (!allowedFile(body.file)) return res.status(400).json({ error: 'Invalid filename.' });
  if (body.action === 'validate') {
    if (typeof body.content !== 'string' || body.content.length > 250_000) return res.status(400).json({ error: 'Dataset is missing or too large.' });
    try { return res.status(200).json(await combinedDataset(body.file, body.content)); }
    catch { return res.status(400).json({ error: 'Invalid JSON in a semester draft.' }); }
  }
  if (body.action === 'undo') {
    const source = typeof body.source === 'string' ? body.source.trim().slice(0, 240) : '';
    if (!source || typeof body.expectedRevision !== 'string') return res.status(400).json({ error: 'A reason and current revision are required.' });
    const before = await redis(['GET', draftKey(body.file)]) || '';
    if (!before) return res.status(400).json({ error: 'There is no saved draft to undo.' });
    if (sha(before) !== body.expectedRevision) return res.status(409).json({ error: 'Another admin updated this draft. Reload before undoing.' });
    const recent = await redis(['LRANGE', HISTORY_KEY, 0, 999]);
    const last = (recent || []).map((row: string) => JSON.parse(row)).find((entry: any) => entry.file === body.file && ['save_draft', 'undo_draft'].includes(entry.action));
    if (!last || last.after !== before || typeof last.before !== 'string') return res.status(409).json({ error: 'A matching history revision was not found. Review the draft manually.' });
    const entry = event(admin, 'undo_draft', { file: body.file, source, changed: changes(before, last.before), before, after: last.before, method: 'Undo last saved draft' });
    if (await undoWithHistory(body.file, before, last.before, entry) !== 1) return res.status(409).json({ error: 'Another admin updated this draft. Reload before undoing.' });
    return res.status(200).json({ revision: last.before ? sha(last.before) : '', entry: JSON.parse(entry) });
  }
  if (body.action === 'undo_live') {
    if (!isCatalogFile(body.file) || typeof body.expectedLiveRevision !== 'string') return res.status(400).json({ error: 'Choose a course file and its latest live revision.' });
    const currentOverride = await redis(['GET', liveKey(body.file)]) || '';
    const current = currentOverride || JSON.stringify(published[body.file]);
    if (sha(current) !== body.expectedLiveRevision) return res.status(409).json({ error: 'Live data changed. Reload before undoing.' });
    const recent = await redis(['LRANGE', HISTORY_KEY, 0, 999]);
    const last = (recent || []).map((row: string) => JSON.parse(row)).find((row: any) => row.file === body.file && ['save_live', 'undo_live'].includes(row.action));
    if (!last || last.after !== currentOverride || typeof last.before !== 'string') return res.status(409).json({ error: 'No matching published revision in history.' });
    const restored = last.before || JSON.stringify(published[body.file]);
    const other = body.file === 'courses.json' ? 'sch.json' : 'courses.json';
    const otherContent = await redis(['GET', liveKey(other)]);
    const check = validateDataset({ semester: publishedSemester, majors: publishedMajors, [body.file.slice(0, -5)]: JSON.parse(restored), [other.slice(0, -5)]: otherContent ? JSON.parse(otherContent) : published[other] });
    if (check.errors.length) return res.status(400).json({ error: 'The previous revision is incompatible with the current catalog.', errors: check.errors.slice(0, 20) });
    const entry = event(admin, 'undo_live', { file: body.file, changed: changes(current, restored), before: currentOverride, after: last.before, method: 'Restore previous public catalog revision' });
    if (await undoLive(body.file, currentOverride, last.before, entry) !== 1) return res.status(409).json({ error: 'Live data changed. Reload before undoing.' });
    return res.status(200).json({ revision: sha(restored), entry: JSON.parse(entry) });
  }
  if (body.action === 'save' || body.action === 'save_draft') {
    const content = typeof body.content === 'string' ? body.content : '';
    const expected = typeof body.expectedRevision === 'string' ? body.expectedRevision : '';
    const source = typeof body.source === 'string' ? body.source.trim().slice(0, 240) : '';
    const error = validData(body.file, content);
    if (error) {
      console.warn('Admin save rejected.', { file: body.file, reason: 'invalid_structure' });
      return res.status(400).json({ error });
    }
    if (!source) return res.status(400).json({ error: 'Add a source or reason for this change.' });
    const before = await redis(['GET', draftKey(body.file)]) || '';
    if (sha(before) !== expected && !(before === '' && expected === '')) return res.status(409).json({ error: 'Another admin updated this draft. Reload it before saving.' });
    if (body.action === 'save' && isCatalogFile(body.file)) {
      const liveOverride = await redis(['GET', liveKey(body.file)]) || '';
      const live = liveOverride || JSON.stringify(published[body.file]);
      if (typeof body.expectedLiveRevision !== 'string' || sha(live) !== body.expectedLiveRevision) return res.status(409).json({ error: 'The live catalog changed. Reload this file and review the latest version before saving.' });
      if (JSON.stringify(JSON.parse(live)) === JSON.stringify(JSON.parse(content))) {
        console.warn('Admin save rejected.', { file: body.file, reason: 'unchanged_live_data' });
        return res.status(400).json({ error: 'There are no changes to publish.' });
      }
      const other = body.file === 'courses.json' ? 'sch.json' : 'courses.json';
      const otherContent = await redis(['GET', liveKey(other)]);
      const check = validateDataset({ semester: publishedSemester, majors: publishedMajors, [body.file.slice(0, -5)]: JSON.parse(content), [other.slice(0, -5)]: otherContent ? JSON.parse(otherContent) : published[other] });
      if (check.errors.length) {
        console.warn('Admin save rejected.', { file: body.file, reason: 'catalog_validation', count: check.errors.length });
        return res.status(400).json({ error: `Fix ${check.errors.length} catalog errors before saving.`, errors: check.errors.slice(0, 20) });
      }
      const ids = (value: string) => (JSON.parse(value) as Array<{ id: string }>).map(course => course.id).sort().join('\n');
      if (ids(content) !== ids(live)) {
        console.warn('Admin save rejected.', { file: body.file, reason: 'course_ids_changed' });
        return res.status(400).json({ error: 'Adding or removing courses requires a reviewed deployment; this save can update existing courses only.' });
      }
      const entry = event(admin, 'save_live', { file: body.file, source, changed: changes(live, content), before: liveOverride, after: content, method: 'Save and publish catalog' });
      if (await saveLive(body.file, before, liveOverride, content, entry) !== 1) return res.status(409).json({ error: 'Another admin updated this draft or live catalog. Reload and review again.' });
      return res.status(200).json({ revision: sha(content), liveRevision: sha(content), entry: JSON.parse(entry), published: true });
    }
    if (before === content) return res.status(400).json({ error: 'There are no changes to save.' });
    const entry = event(admin, 'save_draft', { file: body.file, source, changed: changes(before, content), before, after: content, method: 'Planora admin JSON editor' });
    const result = await saveWithHistory(body.file, before, content, entry);
    if (result !== 1) return res.status(409).json({ error: 'Another admin updated this draft. Reload it before saving.' });
    return res.status(200).json({ revision: sha(content), entry: JSON.parse(entry) });
  }
  if (body.action === 'export') {
    const content = await redis(['GET', draftKey(body.file)]);
    if (!content) return res.status(400).json({ error: 'Save a draft before exporting it.' });
    const check = await combinedDataset();
    if (check.errors.length) return res.status(400).json({ error: `Semester draft has ${check.errors.length} validation errors. Run Check whole semester first.`, errors: check.errors.slice(0, 20) });
    await redis(['LPUSH', HISTORY_KEY, event(admin, 'export_draft', { file: body.file, revision: sha(content), method: 'JSON download' })]);
    return res.status(200).json({ content });
  }
  return NOT_HANDLED;
}
