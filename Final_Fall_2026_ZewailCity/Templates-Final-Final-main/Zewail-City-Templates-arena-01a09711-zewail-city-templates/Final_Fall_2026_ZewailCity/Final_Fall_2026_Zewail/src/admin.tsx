import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import courses from './semester/courses.json';
import sch from './semester/sch.json';
import majors from './semester/majors.json';
import semester from './semester/semester.json';
import { CREATOR_CREDIT } from './config/semester';

type FileName = 'semester.json' | 'courses.json' | 'majors.json' | 'sch.json';
type AuditEntry = { id: string; at: string; adminName: string; action: string; file?: string; source?: string; method?: string; changed?: string[]; before?: string; after?: string; revision?: string };
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
  const [file, setFile] = useState<FileName>('semester.json');
  const [text, setText] = useState(JSON.stringify(seed['semester.json'], null, 2));
  const [revision, setRevision] = useState('');
  const [source, setSource] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<'editor' | 'history'>('editor');

  const refreshHistory = useCallback(async (index: number) => {
    const data = await request(`/api/admin?action=history&page=${index}`);
    setEntries(data.entries || []);
  }, []);
  const loadFile = useCallback(async (name: FileName) => {
    const data = await request(`/api/admin?action=draft&file=${name}`);
    setText(data.content ?? JSON.stringify(seed[name], null, 2));
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

  const login = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const data = await post({ action: 'login', username, password });
      setPassword(''); setUser(data.user.name); setStatus('authenticated');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not sign in.'); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    try { await request('/api/admin', { method: 'DELETE' }); setStatus('login'); setUser(''); setEntries([]); setText(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not log out.'); }
  };
  const save = async () => {
    setBusy(true); setMessage('');
    try {
      const data = await post({ action: 'save', file, content: text, expectedRevision: revision, source });
      setRevision(data.revision); setSource('');
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
    {status === 'login' && <form className="panel max-w-md space-y-4 p-6" onSubmit={event => void login(event)}><h2 className="text-lg font-bold">Sign in</h2><label className="block text-sm">Username<input className="select mt-1" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} /></label><label className="block text-sm">Password<input className="select mt-1" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>{error && <p role="alert" className="text-sm" style={{ color: 'var(--warn)' }}>{error}</p>}<button disabled={busy} className="btn btn-accent w-full p-3">Sign in</button></form>}
    {status === 'authenticated' && <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-4">{[[String(courses.length + sch.length), 'Courses'], [String([...courses, ...sch].flatMap(course => course.instructors.flatMap(instructor => [...instructor.lectures, ...instructor.labs, ...instructor.tutorials])).length), 'Meetings'], [String(majors.length), 'Majors'], [semester.dataLastVerified, 'Data verified']].map(([value, label]) => <div key={label} className="panel p-4"><p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{value}</p><p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p></div>)}</section>
      <section className="panel p-5"><h2 className="text-lg font-bold">Course coverage</h2><p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>Empty plans remain empty until verified course data arrives.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{majors.map(major => <div className="panel-soft p-3" key={major.id}><b>{major.title}</b>{major.years.map(year => <p key={year.id} className="text-xs" style={{ color: 'var(--muted)' }}>{year.label}: {year.courseIds.length ? `${year.courseIds.length} courses` : 'Not published'}</p>)}</div>)}</div></section>
      <section className="panel p-5"><h2 className="text-lg font-bold">Student reports</h2><p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Students submit reports to GitHub Issues. Reports do not arrive by email.</p><a className="btn mt-3 inline-flex px-4 py-2" href="https://github.com/Ahmedamir21/Planora/issues" target="_blank" rel="noreferrer">Open Planora issues ↗</a></section>
      <div className="flex gap-2"><button className={`btn px-4 py-2 ${tab === 'editor' ? 'btn-accent' : ''}`} onClick={() => setTab('editor')}>Data drafts</button><button className={`btn px-4 py-2 ${tab === 'history' ? 'btn-accent' : ''}`} onClick={() => setTab('history')}>Activity history</button></div>
      {tab === 'editor' && <section className="panel p-5"><h2 className="text-lg font-bold">Semester data drafts</h2><p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>Changes are private drafts. Every save records the account, time, changed fields and source. Publication still needs a reviewed GitHub commit.</p><div className="mb-3 flex flex-wrap gap-2">{filenames.map(name => <button key={name} className={`btn px-3 py-2 ${file === name ? 'btn-accent' : ''}`} disabled={busy} onClick={() => void loadFile(name).catch(cause => setMessage(String(cause)))}>{name}</button>)}</div><label className="block text-xs font-semibold" htmlFor="admin-json">Editing {file}</label><textarea id="admin-json" className="select mt-2 min-h-64 w-full font-mono text-xs" spellCheck={false} value={text} onChange={event => setText(event.target.value)} /><label className="mt-3 block text-xs font-semibold">Source or reason for this change<input className="select mt-1" maxLength={240} placeholder="e.g. checked against Self-Service on 2026-09-24" value={source} onChange={event => setSource(event.target.value)} /></label><div className="mt-3 flex flex-wrap gap-3"><button className="btn btn-accent px-4 py-2" disabled={busy || !source.trim()} onClick={() => void save()}>Save private draft & record history</button><button className="btn px-4 py-2" disabled={busy} onClick={() => void exportFile()}>Export last saved draft</button><button className="btn px-4 py-2" disabled={busy} onClick={() => void loadFile(file).catch(cause => setMessage(String(cause)))}>Reload saved draft</button></div></section>}
      {tab === 'history' && <section className="panel p-5"><h2 className="text-lg font-bold">Activity history</h2><p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>The server stores this history outside the deployment. Each saved change includes before and after snapshots.</p>{entries.map(entry => <article className="panel-soft mb-2 p-3" key={entry.id}><p className="text-sm font-semibold">{entry.adminName} · {entry.action.replace(/_/g, ' ')}{entry.file && ` · ${entry.file}`}</p><p className="text-xs" style={{ color: 'var(--muted)' }}>{new Date(entry.at).toLocaleString()}{entry.changed?.length ? ` · Changed: ${entry.changed.join(', ')}` : ''}{entry.method ? ` · Via: ${entry.method}` : ''}{entry.source ? ` · Source: ${entry.source}` : ''}</p>{entry.before !== undefined && <details className="mt-2 text-xs"><summary className="cursor-pointer">Show exact before / after JSON</summary><div className="mt-2 grid gap-2 lg:grid-cols-2"><div><b>Before</b><pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all">{entry.before || '(no previous draft)'}</pre></div><div><b>After</b><pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all">{entry.after}</pre></div></div></details>}</article>)}{entries.length === 0 && <p className="text-sm">No activity on this page yet.</p>}<div className="mt-3 flex gap-2"><button className="btn px-3 py-2" disabled={busy || page === 0} onClick={() => void nextPage(page - 1)}>Newer</button><span className="pill">Page {page + 1}</span><button className="btn px-3 py-2" disabled={busy || entries.length < 20} onClick={() => void nextPage(page + 1)}>Older</button></div></section>}
      {message && <p role="status" className="panel p-3 text-sm">{message}</p>}
    </div>}
    <footer className="mt-8 text-center text-sm font-semibold" style={{ color: 'var(--accent)' }}>{CREATOR_CREDIT}</footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Admin />);
