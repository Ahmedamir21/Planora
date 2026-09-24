import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import courses from './semester/courses.json';
import sch from './semester/sch.json';
import majors from './semester/majors.json';
import semester from './semester/semester.json';
import { CREATOR_CREDIT } from './config/semester';

type FileName = 'semester.json' | 'courses.json' | 'majors.json' | 'sch.json';
const seed: Record<FileName, unknown> = {
  'semester.json': semester, 'courses.json': courses, 'majors.json': majors, 'sch.json': sch,
};
const filenames = Object.keys(seed) as FileName[];

function validateDraft(name: FileName, value: unknown): string[] {
  const errors: string[] = [];
  if (name === 'semester.json') {
    const v = value as typeof semester;
    if (!v || typeof v.key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.calendarStartDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(v.calendarEndDate || '') || v.calendarEndDate < v.calendarStartDate) errors.push('Check semester key and calendar dates.');
  } else if (!Array.isArray(value)) errors.push('This file must contain a JSON array.');
  else if (name === 'majors.json') {
    for (const major of value) if (!major.id || !Array.isArray(major.years) || major.years.some((year: { courseIds?: unknown }) => !Array.isArray(year.courseIds))) errors.push(`Invalid major/year: ${major.id || '(unnamed)'}`);
  } else for (const course of value) {
    if (!course.id || !course.code || !course.name || !Array.isArray(course.instructors)) errors.push(`Invalid course: ${course.id || '(unnamed)'}`);
    for (const instructor of course.instructors || []) for (const meeting of [...(instructor.lectures || []), ...(instructor.labs || []), ...(instructor.tutorials || [])]) {
      if (!['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].includes(meeting.day) || !Number.isInteger(meeting.start) || !Number.isInteger(meeting.end) || meeting.start >= meeting.end) errors.push(`Invalid meeting: ${course.id} Sec ${meeting.sec}`);
    }
  }
  return errors.slice(0, 8);
}

function Admin() {
  const [status, setStatus] = useState<'checking' | 'login' | 'authenticated' | 'unconfigured'>('checking');
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<FileName>('semester.json');
  const [text, setText] = useState(() => JSON.stringify(seed['semester.json'], null, 2));
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/admin', { credentials: 'same-origin', cache: 'no-store' }).then(async response => {
      const data = await response.json();
      if (active) { setStatus(response.status === 503 ? 'unconfigured' : data.authenticated ? 'authenticated' : 'login'); if (response.status === 503) setError(data.error); }
    }).catch(() => { if (active) { setStatus('unconfigured'); setError('Admin API is unavailable here. Open the deployed Planora site.'); } });
    return () => { active = false; };
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    try {
      const response = await fetch('/api/admin', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const data = await response.json(); setPassword('');
      if (!response.ok) throw new Error(data.error || 'Could not sign in.');
      setStatus('authenticated');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not sign in.'); }
  };
  const logout = async () => { await fetch('/api/admin', { method: 'DELETE', credentials: 'same-origin' }); setStatus('login'); };
  const choose = (name: FileName) => { setFile(name); setText(JSON.stringify(seed[name], null, 2)); setMessage(''); };
  const exportFile = () => {
    try {
      const parsed: unknown = JSON.parse(text);
      const errors = validateDraft(file, parsed);
      if (errors.length) { setMessage(errors.join(' ')); return; }
      const blob = new Blob([JSON.stringify(parsed, null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = file; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`Downloaded ${file}. Review it against Self-Service, replace src/semester/${file}, and run npm run test:data before publishing.`);
    } catch { setMessage('Invalid JSON. Correct the syntax before exporting.'); }
  };

  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <header className="panel mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
      <div><span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Planora · Private workspace</span><h1 className="mt-1 text-2xl font-bold">Admin panel</h1><p className="text-xs" style={{ color: 'var(--muted)' }}>Independent student project · {semester.term} {semester.year} · {semester.session}</p></div>
      <div className="flex gap-2"><a className="btn px-4 py-2" href="/">View planner</a>{status === 'authenticated' && <button className="btn px-4 py-2" onClick={() => void logout()}>Log out</button>}</div>
    </header>
    {status === 'checking' && <section className="panel p-6">Checking your session…</section>}
    {status === 'unconfigured' && <section className="panel max-w-xl p-6"><h2 className="font-bold">Login needs setup</h2><p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{error}</p><p className="mt-2 text-sm">See <code>docs/ADMIN_PANEL.md</code> in the repository for the exact setup and password rotation steps.</p></section>}
    {status === 'login' && <form className="panel max-w-md space-y-4 p-6" onSubmit={event => void login(event)}><h2 className="text-lg font-bold">Sign in</h2><label className="block text-sm">Username<input className="select mt-1" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} /></label><label className="block text-sm">Password<input className="select mt-1" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>{error && <p role="alert" className="text-sm" style={{ color: 'var(--warn)' }}>{error}</p>}<button className="btn btn-accent w-full p-3">Sign in</button></form>}
    {status === 'authenticated' && <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-4">{[[String(courses.length + sch.length), 'Courses'], [String([...courses, ...sch].flatMap(course => course.instructors.flatMap(instructor => [...instructor.lectures, ...instructor.labs, ...instructor.tutorials])).length), 'Meetings'], [String(majors.length), 'Majors'], [semester.dataLastVerified, 'Data verified']].map(([value, label]) => <div key={label} className="panel p-4"><p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{value}</p><p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p></div>)}</section>
      <section className="panel p-5"><h2 className="text-lg font-bold">Course coverage</h2><p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>Empty plans remain empty until verified course data arrives.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{majors.map(major => <div className="panel-soft p-3" key={major.id}><b>{major.title}</b>{major.years.map(year => <p key={year.id} className="text-xs" style={{ color: 'var(--muted)' }}>{year.label}: {year.courseIds.length ? `${year.courseIds.length} courses` : 'Not published'}</p>)}</div>)}</div></section>
      <section className="panel p-5"><h2 className="text-lg font-bold">Review reports</h2><p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Student reports are submitted to GitHub Issues after the student reviews the draft. Nothing is sent to email automatically.</p><a className="btn mt-3 inline-flex px-4 py-2" href="https://github.com/Ahmedamir21/Planora/issues" target="_blank" rel="noreferrer">Open Planora issues ↗</a></section>
      <section className="panel p-5"><h2 className="text-lg font-bold">Semester data editor</h2><p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>Edit a local copy, validate, and export JSON. Nothing changes on the public site until a reviewed GitHub commit and deployment. Never invent academic facts.</p><div className="mb-3 flex flex-wrap gap-2">{filenames.map(name => <button key={name} className={`btn px-3 py-2 ${file === name ? 'btn-accent' : ''}`} onClick={() => choose(name)}>{name}</button>)}</div><label className="block text-xs font-semibold" htmlFor="admin-json">Editing {file}</label><textarea id="admin-json" className="select mt-2 min-h-64 w-full font-mono text-xs" spellCheck={false} value={text} onChange={event => setText(event.target.value)} /><div className="mt-3 flex flex-wrap items-center gap-3"><button className="btn btn-accent px-4 py-2" onClick={exportFile}>Validate & download {file}</button><p role="status" className="text-xs" style={{ color: 'var(--muted)' }}>{message}</p></div></section>
    </div>}
    <footer className="mt-8 text-center text-sm font-semibold" style={{ color: 'var(--accent)' }}>{CREATOR_CREDIT}</footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Admin />);
