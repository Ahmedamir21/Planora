import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import courses from './semester/courses.json';
import sch from './semester/sch.json';
import majors from './semester/majors.json';
import semester from './semester/semester.json';
import { CREATOR_CREDIT } from './config/semester';
import { AdminFeedback } from './components/AdminFeedback';
import { AdminCourseEditor } from './components/AdminCourseEditor';
import { applyAdminImport, describeDraftChanges, parseAdminImport } from './lib/adminImport';
import type { Course } from './types';

type FileName = 'semester.json' | 'courses.json' | 'majors.json' | 'sch.json';
type AuditEntry = { id: string; at: string; adminName: string; action: string; file?: string; source?: string; method?: string; changed?: string[]; before?: string; after?: string; revision?: string };
type StudentReport = { id: string; at: string; status: string; types: string[]; courseCode: string; component: string; section: string; details: string; publishedData: string; note?: string; reviewedAt?: string; reviewedBy?: string; emailStatus?: string };
const seed: Record<FileName, unknown> = { 'semester.json': semester, 'courses.json': courses, 'majors.json': majors, 'sch.json': sch };
const filenames = Object.keys(seed) as FileName[];

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The admin service is unavailable.');
  return data;
}
const post = (body: unknown) => request('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function Admin() {
  const [status, setStatus] = useState<'checking' | 'login' | 'authenticated' | 'unconfigured'>('checking');
  const [error, setError] = useState('');
  const [user, setUser] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [file, setFile] = useState<FileName>('semester.json');
  const [text, setText] = useState(JSON.stringify(seed['semester.json'], null, 2));
  const [savedText, setSavedText] = useState(JSON.stringify(seed['semester.json'], null, 2));
  const [importInput, setImportInput] = useState('');
  const [importFormat, setImportFormat] = useState<'paste' | 'csv'>('paste');
  const [importCourseCode, setImportCourseCode] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [datasetCheck, setDatasetCheck] = useState<{ errors: string[]; warnings: string[] } | null>(null);
  const [revision, setRevision] = useState('');
  const [source, setSource] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<'editor' | 'history'>('editor');
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [inboxError, setInboxError] = useState('');

  const refreshReports = useCallback(async () => {
    const result = await request('/api/admin?action=reports');
    setReports(result.reports || []);
    setInboxError('');
  }, []);

  const refreshHistory = useCallback(async (index: number) => {
    const data = await request(`/api/admin?action=history&page=${index}`);
    setEntries(data.entries || []);
  }, []);
  const loadFile = useCallback(async (name: FileName) => {
    const data = await request(`/api/admin?action=draft&file=${name}`);
    const content = data.content ?? JSON.stringify(seed[name], null, 2);
    setText(content); setSavedText(content); setDatasetCheck(null); setImportWarnings([]); setImportInput('');
    setRevision(data.revision || '');
    setFile(name);
    setMessage(data.content ? 'Loaded the latest saved private draft.' : 'No saved draft yet. Showing the published dataset.');
  }, []);

  useEffect(() => {
    let active = true;
    request('/api/admin').then(data => {
      if (active) { setStatus(data.authenticated ? 'authenticated' : 'login'); setUser(data.user?.name || ''); }
    }).catch(cause => {
      if (active) { setStatus('unconfigured'); setError(cause instanceof Error ? cause.message : 'Admin API unavailable.'); }
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (status !== 'authenticated') return;
    void loadFile(file).catch(cause => setMessage(cause instanceof Error ? cause.message : 'Could not load draft.'));
    void refreshHistory(0).catch(() => {});
  }, [status, loadFile, refreshHistory]);
  useEffect(() => {
    if (status !== 'authenticated') return;
    const reload = () => void refreshReports().catch(cause => setInboxError(cause instanceof Error ? cause.message : 'Could not load reports.'));
    reload();
    const interval = window.setInterval(reload, 60_000);
    return () => window.clearInterval(interval);
  }, [status, refreshReports]);

  const reviewReport = async (report: StudentReport, nextStatus: string) => {
    const note = reportNotes[report.id]?.trim();
    if (!note) { setInboxError('Add a note about what you checked before updating the report.'); return; }
    setBusy(true); setInboxError('');
    try {
      await post({ action: 'review_report', id: report.id, status: nextStatus, note });
      setReportNotes(previous => ({ ...previous, [report.id]: '' }));
      await refreshReports();
      await refreshHistory(0);
    } catch (cause) { setInboxError(cause instanceof Error ? cause.message : 'Could not update the report.'); }
    finally { setBusy(false); }
  };

  const login = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const data = await post({ action: 'login', username, password });
      setPassword(''); setShowPassword(false); setUser(data.user.name); setStatus('authenticated');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not sign in.'); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    try { await request('/api/admin', { method: 'DELETE' }); setStatus('login'); setUser(''); setEntries([]); setReports([]); setText(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not log out.'); }
  };
  const save = async () => {
    setBusy(true); setMessage('');
    try {
      const data = await post({ action: 'save', file, content: text, expectedRevision: revision, source });
      setRevision(data.revision); setSavedText(text); setSource(''); setDatasetCheck(null);
      setMessage(`Saved privately by ${data.entry.adminName} at ${new Date(data.entry.at).toLocaleString()}. It is not published to students.`);
      setPage(0); await refreshHistory(0);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not save draft.'); }
    finally { setBusy(false); }
  };
  const exportFile = async () => {
    setBusy(true); setMessage('');
    try {
      const data = await post({ action: 'export', file });
      const blob = new Blob([data.content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = file; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`Downloaded the last saved ${file}. Review it against Self-Service, replace src/semester/${file}, then run full CI before publishing.`);
      setPage(0); await refreshHistory(0);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not export.'); }
    finally { setBusy(false); }
  };
  const checkDraft = async () => {
    setBusy(true); setMessage('');
    try {
      const result = await post({ action: 'validate', file, content: text });
      setDatasetCheck(result); setMessage(result.errors.length ? 'Fix these dataset issues before exporting.' : 'Combined semester draft is structurally ready for review. Verify every academic fact against the source.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not check dataset.'); }
    finally { setBusy(false); }
  };
  const undoSaved = async () => {
    setBusy(true); setMessage('');
    try {
      const data = await post({ action: 'undo', file, expectedRevision: revision, source: source.trim() || 'Undo last saved draft after reviewing changes' });
      await loadFile(file); setSource(''); setMessage(`Undid the last saved ${file} draft. Recorded as ${data.entry.adminName}'s action; nothing was published.`);
      await refreshHistory(0);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not undo draft.'); }
    finally { setBusy(false); }
  };
  const stageImport = () => {
    if (file !== 'courses.json' && file !== 'sch.json') { setImportWarnings(['Choose courses.json or sch.json first.']); return; }
    let dataset: Course[];
    try { dataset = JSON.parse(text); if (!Array.isArray(dataset)) throw new Error('The draft is not a course list.'); }
    catch { setImportWarnings(['Fix the JSON in the current draft before importing.']); return; }
    const parsed = parseAdminImport(importInput, importCourseCode);
    const result = applyAdminImport(dataset, parsed.rows);
    setImportWarnings([...parsed.warnings, ...result.warnings, `${result.applied} of ${parsed.rows.length} complete sections staged. Review the comparison, then save the private draft.`]);
    if (result.applied) { setText(JSON.stringify(result.courses, null, 2)); setDatasetCheck(null); }
  };
  const changes = describeDraftChanges(savedText, text);
  let editableCourses: Course[] | null = null;
  if (file === 'courses.json' || file === 'sch.json') {
    try { const parsed = JSON.parse(text); if (Array.isArray(parsed)) editableCourses = parsed; } catch { /* Show the JSON error through the existing validator. */ }
  }
  const nextPage = async (index: number) => {
    setBusy(true);
    try { await refreshHistory(index); setPage(index); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not load history.'); }
    finally { setBusy(false); }
  };

  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <header className="panel mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
      <div><span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Planora · Private workspace</span><h1 className="mt-1 text-2xl font-bold">Admin panel</h1><p className="text-xs" style={{ color: 'var(--muted)' }}>Independent student project · {semester.term} {semester.year} · {semester.session}</p></div>
      <div className="flex items-center gap-2">{user && <span className="pill">Signed in: {user}</span>}<a className="btn px-4 py-2" href="/">View planner</a>{status === 'authenticated' && <button className="btn px-4 py-2" onClick={() => void logout()}>Log out</button>}</div>
    </header>
    {status === 'checking' && <section className="panel p-6">Checking your session…</section>}
    {status === 'unconfigured' && <section className="panel max-w-xl p-6"><h2 className="font-bold">Login needs setup</h2><p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{error}</p><p className="mt-2 text-sm">See <code>docs/ADMIN_PANEL.md</code> for the two password hashes and persistent history setup.</p></section>}
    {status === 'login' && <form className="panel max-w-md space-y-4 p-6" onSubmit={event => void login(event)}><h2 className="text-lg font-bold">Sign in</h2><label className="block text-sm" htmlFor="admin-username">Username</label><input id="admin-username" className="select mt-1" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} /><label className="block text-sm" htmlFor="admin-password">Password</label><div className="flex items-center gap-2"><input id="admin-password" className="select mt-1 min-w-0 flex-1" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /><button type="button" className="btn shrink-0 px-3 py-2" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(previous => !previous)}>{showPassword ? 'Hide' : 'Show'}</button></div>{error && <p role="alert" className="text-sm" style={{ color: 'var(--warn)' }}>{error}</p>}<button disabled={busy} className="btn btn-accent w-full p-3">Sign in</button></form>}
    {status === 'authenticated' && <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-4">{[[String(courses.length + sch.length), 'Courses'], [String([...courses, ...sch].flatMap(course => course.instructors.flatMap(instructor => [...instructor.lectures, ...instructor.labs, ...instructor.tutorials])).length), 'Meetings'], [String(majors.length), 'Majors'], [semester.dataLastVerified, 'Data verified']].map(([value, label]) => <div key={label} className="panel p-4"><p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{value}</p><p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p></div>)}</section>
      <section className="panel p-5"><h2 className="text-lg font-bold">Course coverage</h2><p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>Empty plans remain empty until verified course data arrives.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{majors.map(major => <div className="panel-soft p-3" key={major.id}><b>{major.title}</b>{major.years.map(year => <p key={year.id} className="text-xs" style={{ color: 'var(--muted)' }}>{year.label}: {year.courseIds.length ? `${year.courseIds.length} courses` : 'Not published'}</p>)}</div>)}</div></section>
      <section className="panel p-5"><h2 className="text-lg font-bold">Student reports {reports.filter(report => report.status === 'new').length > 0 && <span className="pill ml-2" role="status">{reports.filter(report => report.status === 'new').length} new</span>}</h2><p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Reports arrive here without GitHub login. This inbox checks for new reports every minute while the admin page is open. Reviews and decisions stay private.</p><button className="btn mt-3 px-3 py-2" onClick={() => void refreshReports().catch(cause => setInboxError(String(cause)))}>Refresh inbox</button>{inboxError && <p role="alert" className="mt-2 text-sm" style={{ color: 'var(--warn)' }}>{inboxError}</p>}{reports.length === 0 && <p className="mt-3 text-sm">No reports yet.</p>}{reports.map(report => <article key={report.id} className="panel-soft mt-3 p-4"><p className="font-semibold">{report.courseCode || 'General'} · {report.types.join(', ')} <span className="pill">{report.status.replace(/_/g, ' ')}</span></p><p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{new Date(report.at).toLocaleString()} · {report.component || 'General'} {report.section && `· Section ${report.section}`} · Email alert: {report.emailStatus || 'not configured'}</p><p className="mt-2 whitespace-pre-wrap text-sm">{report.details}</p>{report.publishedData && <details className="mt-2 text-xs"><summary className="cursor-pointer">Data the student saw</summary><pre className="mt-2 whitespace-pre-wrap break-words">{report.publishedData}</pre></details>}{report.note && <p className="mt-2 text-xs">Last review by {report.reviewedBy}: {report.note}</p>}<div className="mt-3 flex flex-wrap items-center gap-2"><a className="btn px-3 py-2" href="https://sisselfservice.zewailcity.edu.eg/PowerCampusSelfService/Registration/Courses" target="_blank" rel="noreferrer">Open Self-Service to check ↗</a><input aria-label={`Review note for ${report.courseCode || report.id}`} className="select min-w-48 flex-1" maxLength={500} placeholder="What did you verify? (required)" value={reportNotes[report.id] || ''} onChange={event => setReportNotes(previous => ({ ...previous, [report.id]: event.target.value }))} /><button disabled={busy} className="btn px-3 py-2" onClick={() => void reviewReport(report, 'checking')}>Checking</button><button disabled={busy} className="btn px-3 py-2" onClick={() => void reviewReport(report, 'dismissed')}>No change · dismiss</button><button disabled={busy} className="btn px-3 py-2" onClick={() => void reviewReport(report, 'correction_needed')}>Change found</button><button disabled={busy} className="btn px-3 py-2" onClick={() => void reviewReport(report, 'resolved')}>Corrected · close</button></div></article>)}</section>
      <AdminFeedback onReviewed={() => void refreshHistory(0).catch(() => {})} />
      <div className="flex gap-2"><button className={`btn px-4 py-2 ${tab === 'editor' ? 'btn-accent' : ''}`} onClick={() => setTab('editor')}>Data drafts</button><button className={`btn px-4 py-2 ${tab === 'history' ? 'btn-accent' : ''}`} onClick={() => setTab('history')}>Activity history</button></div>
      {tab === 'editor' && <section className="panel p-5"><h2 className="text-lg font-bold">Semester data drafts</h2><p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>Imports and edits stay private until an admin reviews and saves them. Export still needs a reviewed GitHub commit to reach students.</p><div className="mb-3 flex flex-wrap gap-2">{filenames.map(name => <button key={name} className={`btn px-3 py-2 ${file === name ? 'btn-accent' : ''}`} disabled={busy} onClick={() => void loadFile(name).catch(cause => setMessage(String(cause)))}>{name}</button>)}</div>
        {editableCourses && <AdminCourseEditor key={file} courses={editableCourses} onChange={next => { setText(JSON.stringify(next, null, 2)); setDatasetCheck(null); }} />}
        {(file === 'courses.json' || file === 'sch.json') && <div className="panel-soft mb-4 p-4"><h3 className="font-semibold">Import published sections</h3><p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Copy the course search results from Self-Service, or upload a CSV. Only complete sections for courses already in this draft are staged; nothing is fetched from your university account.</p><div className="mt-3 flex gap-2"><button className={`btn px-3 py-2 ${importFormat === 'paste' ? 'btn-accent' : ''}`} type="button" onClick={() => setImportFormat('paste')}>Paste results</button><button className={`btn px-3 py-2 ${importFormat === 'csv' ? 'btn-accent' : ''}`} type="button" onClick={() => setImportFormat('csv')}>Upload CSV</button></div><label className="mt-3 block text-xs font-semibold">Course if copied results have no heading<select className="select mt-1" value={importCourseCode} onChange={event => setImportCourseCode(event.target.value)}><option value="">Choose a course if needed</option>{(JSON.parse(savedText) as typeof courses).map(course => <option key={course.id} value={course.code}>{course.code} · {course.name}</option>)}</select></label>{importFormat === 'csv' && <label className="mt-3 block text-xs font-semibold">CSV file<input className="select mt-1 w-full" type="file" accept=".csv,text/csv" onChange={event => { const chosen = event.target.files?.[0]; if (chosen) void chosen.text().then(value => { setImportInput(value); setImportWarnings([]); }).catch(() => setImportWarnings(['Could not read the CSV file.'])); }} /></label>}<label className="mt-3 block text-xs font-semibold" htmlFor="admin-import">{importFormat === 'csv' ? 'CSV preview (courseCode,subtype,section,day,start,end,room,instructor)' : 'Copied Self-Service search results'}<textarea id="admin-import" className="select mt-1 min-h-28 w-full font-mono text-xs" value={importInput} onChange={event => setImportInput(event.target.value)} placeholder={importFormat === 'csv' ? 'courseCode,subtype,section,day,start,end,room,instructor' : 'CSAI 205: ...\nSubtype: Lecture | Section: 03\n10:00 AM - 11:59 AM\nTuesday\n... Room G006-B\nInstructor name'} /></label><button className="btn mt-3 px-4 py-2" type="button" onClick={stageImport}>Stage sections for review</button>{importWarnings.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs" role="status">{importWarnings.slice(0, 25).map((warning, index) => <li key={index}>{warning}</li>)}</ul>}</div>}
        <label className="block text-xs font-semibold" htmlFor="admin-json">Editing {file}</label><textarea id="admin-json" className="select mt-2 min-h-64 w-full font-mono text-xs" spellCheck={false} value={text} onChange={event => { setText(event.target.value); setDatasetCheck(null); }} />
        <div className="panel-soft mt-4 p-4"><h3 className="font-semibold">Review before saving · {changes.length} changes</h3>{changes.length ? <ul className="mt-2 max-h-56 list-disc space-y-1 overflow-auto pl-5 text-xs">{changes.slice(0, 100).map((change, index) => <li key={index}>{change}</li>)}{changes.length > 100 && <li>{changes.length - 100} more changes; review the JSON export.</li>}</ul> : <p className="mt-2 text-xs">No changes since the loaded draft.</p>}<button className="btn mt-3 px-3 py-2" type="button" disabled={!changes.length} onClick={() => { setText(savedText); setImportWarnings([]); }}>Discard unsaved edits</button></div>
        <label className="mt-3 block text-xs font-semibold">Source or reason for this change<input className="select mt-1" maxLength={240} placeholder="e.g. checked against Self-Service on 2026-09-24" value={source} onChange={event => setSource(event.target.value)} /></label><div className="mt-3 flex flex-wrap gap-3"><button className="btn btn-accent px-4 py-2" disabled={busy || !source.trim() || !changes.length} onClick={() => void save()}>Save private draft & record history</button><button className="btn px-4 py-2" disabled={busy} onClick={() => void checkDraft()}>Check whole semester</button><button className="btn px-4 py-2" disabled={busy} onClick={() => void exportFile()}>Export last saved draft</button><button className="btn px-4 py-2" disabled={busy || !revision} onClick={() => void undoSaved()}>Undo last saved draft</button><button className="btn px-4 py-2" disabled={busy} onClick={() => void loadFile(file).catch(cause => setMessage(String(cause)))}>Reload saved draft</button></div>{datasetCheck && <div className="mt-3 text-xs" role="status"><p>{datasetCheck.errors.length} errors · {datasetCheck.warnings.length} warnings</p>{datasetCheck.errors.slice(0, 20).map((issue, index) => <p className="mt-1" key={index} style={{ color: 'var(--warn)' }}>Error: {issue}</p>)}{datasetCheck.warnings.slice(0, 10).map((issue, index) => <p className="mt-1" key={index}>Warning: {issue}</p>)}</div>}</section>}
      {tab === 'history' && <section className="panel p-5"><h2 className="text-lg font-bold">Activity history</h2><p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>The server stores this history outside the deployment. Each saved change includes before and after snapshots.</p>{entries.map(entry => <article className="panel-soft mb-2 p-3" key={entry.id}><p className="text-sm font-semibold">{entry.adminName} · {entry.action.replace(/_/g, ' ')}{entry.file && ` · ${entry.file}`}</p><p className="text-xs" style={{ color: 'var(--muted)' }}>{new Date(entry.at).toLocaleString()}{entry.changed?.length ? ` · Changed: ${entry.changed.join(', ')}` : ''}{entry.method ? ` · Via: ${entry.method}` : ''}{entry.source ? ` · Source: ${entry.source}` : ''}</p>{entry.before !== undefined && <details className="mt-2 text-xs"><summary className="cursor-pointer">Show exact before / after JSON</summary><div className="mt-2 grid gap-2 lg:grid-cols-2"><div><b>Before</b><pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all">{entry.before || '(no previous draft)'}</pre></div><div><b>After</b><pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all">{entry.after}</pre></div></div></details>}</article>)}{entries.length === 0 && <p className="text-sm">No activity on this page yet.</p>}<div className="mt-3 flex gap-2"><button className="btn px-3 py-2" disabled={busy || page === 0} onClick={() => void nextPage(page - 1)}>Newer</button><span className="pill">Page {page + 1}</span><button className="btn px-3 py-2" disabled={busy || entries.length < 20} onClick={() => void nextPage(page + 1)}>Older</button></div></section>}
      {message && <p role="status" className="panel p-3 text-sm">{message}</p>}
    </div>}
    <footer className="mt-8 text-center text-sm font-semibold" style={{ color: 'var(--accent)' }}>{CREATOR_CREDIT}</footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Admin />);
