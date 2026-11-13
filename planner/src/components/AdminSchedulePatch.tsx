import { useState } from 'react';
import type { Course } from '../types';
import { previewSchedulePatch, SCHEDULE_CSV_HEADER, SCHEDULE_CSV_LIMIT, type SchedulePatchReport } from '../lib/schedulePatch';

type FileName = 'courses.json' | 'sch.json';
type Draft = { content?: string; revision?: string };

export function AdminSchedulePatch({ published, readDraft, saveDraft, onSaved, unsavedEditor }: {
  published: Record<FileName, Course[]>;
  readDraft: (file: FileName) => Promise<Draft>;
  saveDraft: (file: FileName, content: string, revision: string, source: string) => Promise<void>;
  onSaved: (file: FileName) => void;
  unsavedEditor: boolean;
}) {
  const [csv, setCsv] = useState('');
  const [report, setReport] = useState<SchedulePatchReport | null>(null);
  const [revisions, setRevisions] = useState<Record<FileName, string>>({ 'courses.json': '', 'sch.json': '' });
  const [saved, setSaved] = useState<FileName[]>([]);
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function preview() {
    setBusy(true); setMessage(''); setReport(null); setSaved([]); setSource('');
    try {
      const files: FileName[] = ['courses.json', 'sch.json'];
      const drafts = await Promise.all(files.map(file => readDraft(file)));
      const current = {} as Record<FileName, Course[]>;
      const versions = {} as Record<FileName, string>;
      files.forEach((file, index) => {
        const draft = drafts[index];
        current[file] = draft.content ? JSON.parse(draft.content) as Course[] : published[file];
        if (!Array.isArray(current[file])) throw new Error(`${file} private draft is not a course list.`);
        versions[file] = draft.revision ?? '';
      });
      setRevisions(versions);
      setReport(previewSchedulePatch(csv, current));
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not load the current private drafts.'); }
    finally { setBusy(false); }
  }

  async function save(file: FileName) {
    if (!report || !source.trim() || saved.includes(file)) return;
    setBusy(true); setMessage('');
    try {
      await saveDraft(file, JSON.stringify(report.next[file], null, 2), revisions[file], source.trim());
      setSaved(previous => [...previous, file]);
      setMessage(`Saved ${file} as a private draft with history. It is not published. Other affected files must be saved separately.`);
      onSaved(file);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : `Could not save ${file}. Preview again if another admin changed the draft.`); }
    finally { setBusy(false); }
  }

  const affected = (['courses.json', 'sch.json'] as const).filter(file => report?.changes.some(change => change.file === file));
  return <section className="panel p-5" aria-labelledby="schedule-patch-title">
    <h3 id="schedule-patch-title" className="text-lg font-bold">Update times and rooms only</h3>
    <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>One Fall 2026 / Main Session CSV updates existing sections in courses.json and sch.json. Nothing is published to students; instructor, credits and course metadata stay unchanged. One meeting per section is supported. Multiple meeting entries are held for review.</p>
    <p className="mt-2 text-xs">Columns: <code>{SCHEDULE_CSV_HEADER}</code> · Limit: {SCHEDULE_CSV_LIMIT.toLocaleString()} characters per import. Split by full CSV rows with a header in each file; review all batches. Blank room is an extraction failure and is excluded. Use <code>ROOM_UNPUBLISHED</code> only after confirming the official source explicitly has no room.</p>
    <label className="mt-3 block text-xs font-semibold">Upload CSV from a verified source
      <input className="select mt-1 w-full" type="file" accept=".csv,text/csv" onChange={event => {
        const file = event.target.files?.[0];
        if (file) void file.text().then(value => { setCsv(value); setReport(null); setMessage(''); }).catch(() => setMessage('Could not read CSV file.'));
      }} />
    </label>
    <label className="mt-3 block text-xs font-semibold">Or paste the CSV
      <textarea className="select mt-1 min-h-28 w-full font-mono text-xs" value={csv} onChange={event => { setCsv(event.target.value); setReport(null); setSaved([]); }} placeholder={`${SCHEDULE_CSV_HEADER}\nCSAI 205,Lecture,03,Tue,10:00,12:00,G006-B`} />
    </label>
    {unsavedEditor && <p role="alert" className="mt-2 text-xs" style={{ color: 'var(--warn)' }}>The JSON editor has unsaved changes. Save or discard them first; this preview uses the latest saved private drafts.</p>}
    <button className="btn mt-3 px-4 py-2" type="button" disabled={busy || unsavedEditor || !csv.trim()} onClick={() => void preview()}>{busy ? 'Working…' : 'Preview times and rooms against both drafts'}</button>
    {report && <div className="mt-4 space-y-3" role="status">
      {report.fatal ? <p className="text-sm" style={{ color: 'var(--warn)' }}>{report.fatal}</p> : <>
        <p className="font-semibold">Read {report.read} · Applied {report.applied} · Unchanged {report.unchanged} · Excluded {report.excluded}</p>
        {report.issues.length > 0 && <details className="panel-soft p-3" open><summary className="cursor-pointer text-sm font-semibold">Excluded rows and reasons ({report.issues.length})</summary><ul className="mt-2 max-h-64 space-y-1 overflow-auto text-xs">{report.issues.map((issue, i) => <li key={i}>CSV line {issue.line} · {issue.kind}: {issue.reason}</li>)}</ul></details>}
        {report.changes.length > 0 && <details className="panel-soft p-3" open><summary className="cursor-pointer text-sm font-semibold">Before / after changes ({report.changes.length})</summary><ul className="mt-2 max-h-64 space-y-2 overflow-auto text-xs">{report.changes.map(change => <li key={`${change.file}-${change.line}`}>{change.file} · {change.code} {change.component} · {change.before} → {change.after} · CSV time: {change.sourceTime}</li>)}</ul></details>}
        {!!affected.length && <><p className="text-xs">Enter the source (e.g. Self-Service, Fall 2026 Main), then save each affected private draft. Saved files keep their own history and Undo; they are never auto-published.</p><label className="block text-xs font-semibold">Source or reason<input className="select mt-1 w-full" maxLength={240} value={source} onChange={event => setSource(event.target.value)} placeholder="Checked against Self-Service Fall 2026 Main" /></label><div className="flex flex-wrap gap-2">{affected.map(file => <button className="btn btn-accent px-3 py-2" type="button" key={file} disabled={busy || !source.trim() || saved.includes(file)} onClick={() => void save(file)}>{saved.includes(file) ? `Saved ${file}` : `Save ${file} private draft`}</button>)}</div></>}
      </>}
    </div>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
