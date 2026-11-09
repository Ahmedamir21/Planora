import { useState } from 'react';
import type { Course } from '../types';
import { ENGLISH_CSV_HEADER, previewEnglishImport, type EnglishImportReport } from '../lib/englishImport';

export function AdminEnglishImport({ published, readDraft, saveDraft, onSaved, unsavedEditor }: {
  published: Course[];
  readDraft: () => Promise<{ content?: string; revision?: string }>;
  saveDraft: (content: string, revision: string, source: string) => Promise<void>;
  onSaved: () => void;
  unsavedEditor: boolean;
}) {
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<EnglishImportReport | null>(null);
  const [revision, setRevision] = useState('');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  async function check() {
    setBusy(true); setMessage(''); setPreview(null); setSaved(false);
    try {
      const draft = await readDraft();
      const existing = draft.content ? JSON.parse(draft.content) : published;
      if (!Array.isArray(existing)) throw new Error('The private course draft is not a course list.');
      setRevision(draft.revision || '');
      setPreview(previewEnglishImport(csv, existing));
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not load private course draft.'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!preview?.applied || !source.trim() || saved) return;
    setBusy(true); setMessage('');
    try {
      await saveDraft(JSON.stringify(preview.next, null, 2), revision, source.trim());
      setSaved(true); setMessage('Saved as a private draft with history. It is not live for students.'); onSaved();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Save failed. Preview again against the latest draft.'); }
    finally { setBusy(false); }
  }
  return <section className="panel p-5" aria-labelledby="english-import-heading">
    <h3 id="english-import-heading" className="text-lg font-bold">Complete English levels from verified CSV</h3>
    <p className="mt-1 text-xs">ENGL 003, 004, 156 and 157 currently have only their codes. The separate ten-column CSV adds verified name, total course credits and sections to existing shells. It cannot add a fifth course or edit any other course. Exact times only; do not enter displayed :59 endings until verified.</p>
    <p className="mt-2 text-xs">Columns: <code>{ENGLISH_CSV_HEADER}</code>. Repeat the official course name and total credits on every section row. Section numbers like 01 remain text. One meeting per section. Blank rooms mean extraction failure; use ROOM_UNPUBLISHED only if the source explicitly has no room. Use the existing seven-column importer later for verified updates.</p>
    <label className="mt-3 block text-xs font-semibold">Choose English CSV<input type="file" accept=".csv,text/csv" className="select mt-1 w-full" onChange={event => { const file = event.target.files?.[0]; if (file) void file.text().then(value => { setCsv(value); setPreview(null); setSaved(false); }).catch(() => setMessage('Could not read CSV.')); }} /></label>
    <label className="mt-3 block text-xs font-semibold">Or paste CSV<textarea className="select mt-1 min-h-24 w-full font-mono text-xs" value={csv} onChange={event => { setCsv(event.target.value); setPreview(null); setSaved(false); }} placeholder={ENGLISH_CSV_HEADER} /></label>
    {unsavedEditor && <p role="alert" className="mt-2 text-xs">Save or discard unsaved changes in the JSON editor first.</p>}
    <button className="btn mt-3 px-3 py-2" type="button" disabled={busy || unsavedEditor || !csv.trim()} onClick={() => void check()}>Preview English CSV</button>
    {preview && <div className="mt-3 space-y-2 text-xs" role="status">
      <p>Read {preview.read} · staged {preview.applied} sections · held {preview.rejected.length} issues</p>
      {preview.fatal && <p role="alert">{preview.fatal}</p>}
      {preview.rejected.map((issue, index) => <p key={index}>Held: {issue}</p>)}
      {preview.changes.map(change => <p key={change}>Before: code only, no credits or sections → After: {change}</p>)}
      {!!preview.applied && <><label className="block font-semibold">Verified source<input className="select mt-1 w-full" maxLength={240} value={source} onChange={event => setSource(event.target.value)} placeholder="Self-Service Fall 2026 Main, checked on date" /></label><button className="btn btn-accent px-3 py-2" type="button" disabled={busy || saved || !source.trim()} onClick={() => void save()}>{saved ? 'Private draft saved' : 'Save reviewed English draft'}</button></>}
    </div>}
    {message && <p role="status" className="mt-2 text-xs">{message}</p>}
  </section>;
}
