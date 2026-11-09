import { useCallback, useEffect, useState } from 'react';

type SyncStatus = {
  state?: 'Success' | 'Warning' | 'Failed' | 'Not run';
  phase?: string; startedAt?: string; finishedAt?: string; updatedAt?: string;
  courses?: number; sections?: number; warnings?: number; source?: string;
  backupVersion?: string; restoredVersion?: string; errors?: number;
};
type SyncDraft = {
  source?: string; fetchedAt?: string; stagedAt?: string;
  validation?: { warnings?: string[]; summary?: { courses?: number; meetings?: number; missingRooms?: number; unassigned?: number } };
  changes?: { changedCourses?: number; addedCourses?: number; removedCourses?: number; changed?: string[]; added?: string[]; removed?: string[]; previousSections?: number; sections?: number; sectionDelta?: number };
};

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init });
  const data = await response.json();
  if (!response.ok) {
    const details = Array.isArray(data.errors) ? data.errors.slice(0, 8).join(' · ') : '';
    throw new Error([data.error || 'Self-Service Sync is unavailable.', details].filter(Boolean).join(' — '));
  }
  return data;
}
const post = (body: unknown) => request('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const when = (value?: string) => value ? new Date(value).toLocaleString() : '—';

export function AdminSelfServiceSync({ onActivity }: { onActivity?: () => void }) {
  const [status, setStatus] = useState<SyncStatus>({ state: 'Not run', phase: 'idle' });
  const [draft, setDraft] = useState<SyncDraft | null>(null);
  const [draftRevision, setDraftRevision] = useState('');
  const [backups, setBackups] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [restoreReason, setRestoreReason] = useState('');
  const [payload, setPayload] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const data = await request('/api/admin?action=sync_status');
    setStatus(data.status || { state: 'Not run', phase: 'idle' });
    setDraft(data.draft || null);
    setDraftRevision(data.draftRevision || '');
    setBackups(data.backups || []);
  }, []);
  useEffect(() => { void refresh().catch(cause => setMessage(cause instanceof Error ? cause.message : 'Could not load sync status.')); }, [refresh]);

  const stage = async () => {
    setBusy(true); setMessage('');
    try {
      const parsed = JSON.parse(payload);
      if (!parsed || !Array.isArray(parsed.courses) || !Array.isArray(parsed.sch)) throw new Error('Fetched JSON must contain courses[] and sch[].');
      const result = await post({ action: 'sync_stage', dataset: { courses: parsed.courses, sch: parsed.sch }, expectedSyncRevision: draftRevision, source: source.trim() || 'Manual Self-Service sync test', fetchedAt: parsed.fetchedAt, startedAt: parsed.startedAt });
      setMessage(`Draft staged only — live website unchanged. ${result.warnings?.length || 0} warnings need review.`);
      setPayload(''); await refresh(); onActivity?.();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not stage fetched data.'); }
    finally { setBusy(false); }
  };
  const publish = async () => {
    if (!source.trim()) { setMessage('Add what you verified before publishing.'); return; }
    setBusy(true); setMessage('');
    try {
      const result = await post({ action: 'sync_publish', expectedSyncRevision: draftRevision, source: source.trim() });
      setMessage(`Published after validation. Backup ${result.backupVersion} was created first.`);
      setSource(''); await refresh(); onActivity?.();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not publish sync draft.'); }
    finally { setBusy(false); }
  };
  const discard = async () => {
    setBusy(true); setMessage('');
    try {
      await post({ action: 'sync_discard', expectedSyncRevision: draftRevision });
      setMessage('Fetched draft discarded. Live website was not changed.');
      await refresh(); onActivity?.();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not discard sync draft.'); }
    finally { setBusy(false); }
  };
  const downloadBackup = async (version: string) => {
    setBusy(true); setMessage('');
    try {
      const data = await request(`/api/admin?action=sync_backup&version=${encodeURIComponent(version)}`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `planora-${version}.json`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not download backup.'); }
    finally { setBusy(false); }
  };
  const restore = async (version: string, rollback = false) => {
    if (!restoreReason.trim()) { setMessage('Add a restore / rollback reason first.'); return; }
    setBusy(true); setMessage('');
    try {
      await post({ action: 'sync_restore', version, source: restoreReason.trim() });
      setMessage(rollback ? `Rolled back to latest backup ${version}.` : `Restored ${version}. The action was added to Activity History.`);
      setRestoreReason(''); await refresh(); onActivity?.();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not restore backup.'); }
    finally { setBusy(false); }
  };

  const badge = status.state || 'Not run';
  return <section className="panel p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold">Self-Service Sync <span className="pill ml-2">{badge}</span></h2><p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Safe pipeline: Fetched Data → validated Draft → manual Publish. Automated fetches never write directly to Live Data.</p></div>
      <button className="btn px-3 py-2" disabled={busy} onClick={() => void refresh().catch(cause => setMessage(String(cause)))}>Refresh</button>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[[status.phase || 'idle', 'Last phase'], [when(status.startedAt), 'Started'], [when(status.finishedAt || status.updatedAt), 'Finished'], [`${status.courses ?? '—'} / ${status.sections ?? '—'}`, 'Courses / sections']].map(([value,label]) => <div className="panel-soft p-3" key={label}><p className="font-bold">{value}</p><p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p></div>)}
    </div>

    <div className="mt-4 grid gap-3 lg:grid-cols-3">
      <div className="panel-soft p-4"><b>Live Data</b><p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>What students currently receive from the public catalog. It changes only after an explicit Publish or Restore.</p></div>
      <div className="panel-soft p-4"><b>Fetched Data</b><p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Future Playwright runs land here first. Fetching alone can never change the student website.</p></div>
      <div className="panel-soft p-4"><b>Draft</b><p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{draft ? `Ready for review · staged ${when(draft.stagedAt)}` : 'No fetched draft waiting for review.'}</p></div>
    </div>

    {draft && <div className="panel-soft mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Draft review</h3><span className="pill">Live unchanged</span></div>
      <p className="mt-2 text-xs">Source: {draft.source || '—'} · Fetched: {when(draft.fetchedAt)}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div><b>{draft.changes?.changedCourses ?? 0}</b><p className="text-xs">changed courses</p></div>
        <div><b>+{draft.changes?.addedCourses ?? 0} / -{draft.changes?.removedCourses ?? 0}</b><p className="text-xs">course set</p></div>
        <div><b>{draft.changes?.previousSections ?? '—'} → {draft.changes?.sections ?? '—'}</b><p className="text-xs">sections</p></div>
        <div><b>{draft.validation?.summary?.missingRooms ?? 0} / {draft.validation?.summary?.unassigned ?? 0}</b><p className="text-xs">missing rooms / unassigned groups</p></div>
      </div>
      {(draft.validation?.warnings?.length || 0) > 0 && <details className="mt-3 text-xs" open><summary className="cursor-pointer font-semibold">{draft.validation!.warnings!.length} warnings to review</summary><ul className="mt-2 list-disc space-y-1 pl-5">{draft.validation!.warnings!.slice(0,30).map((item,index)=><li key={index}>{item}</li>)}</ul></details>}
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer font-semibold">View Changes</summary>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <div><b>Changed</b>{draft.changes?.changed?.length ? <ul className="mt-1 list-disc pl-5">{draft.changes.changed.map(code=><li key={code}>{code}</li>)}</ul> : <p className="mt-1">None</p>}</div>
          <div><b>Added</b>{draft.changes?.added?.length ? <ul className="mt-1 list-disc pl-5">{draft.changes.added.map(code=><li key={code}>{code}</li>)}</ul> : <p className="mt-1">None</p>}</div>
          <div><b>Removed</b>{draft.changes?.removed?.length ? <ul className="mt-1 list-disc pl-5">{draft.changes.removed.map(code=><li key={code}>{code}</li>)}</ul> : <p className="mt-1">None</p>}</div>
        </div>
        <p className="mt-2" style={{ color: 'var(--muted)' }}>Section count: {draft.changes?.previousSections ?? '—'} → {draft.changes?.sections ?? '—'} ({(draft.changes?.sectionDelta ?? 0) >= 0 ? '+' : ''}{draft.changes?.sectionDelta ?? 0}). Open the fetched JSON only when you need field-by-field inspection.</p>
      </details>
      <label className="mt-3 block text-xs font-semibold">Verification / publish reason<input className="select mt-1" maxLength={240} value={source} onChange={event=>setSource(event.target.value)} placeholder="e.g. Compared with Self-Service search results on 2026-09-29" /></label>
      <div className="mt-3 flex flex-wrap gap-2"><button className="btn btn-accent px-4 py-2" disabled={busy || !source.trim()} onClick={()=>void publish()}>Publish Draft</button><button className="btn px-4 py-2" disabled={busy} onClick={()=>void discard()}>Discard Draft</button></div>
    </div>}

    <details className="panel-soft mt-4 p-4">
      <summary className="cursor-pointer font-semibold">Manual fetched-data test</summary>
      <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>Temporary testing path before Playwright is connected. Upload/paste a JSON object containing <code>courses</code> and <code>sch</code>. It will only create a Draft.</p>
      <label className="mt-3 block text-xs font-semibold">Fetched JSON file<input className="select mt-1 w-full" type="file" accept=".json,application/json" onChange={event=>{const file=event.target.files?.[0]; if(file) void file.text().then(setPayload).catch(()=>setMessage('Could not read JSON file.'));}} /></label>
      <textarea className="select mt-3 min-h-32 w-full font-mono text-xs" value={payload} onChange={event=>setPayload(event.target.value)} placeholder='{"courses":[],"sch":[]}' />
      <label className="mt-3 block text-xs font-semibold">Source label<input className="select mt-1" maxLength={240} value={source} onChange={event=>setSource(event.target.value)} placeholder="Manual Self-Service comparison" /></label>
      <button className="btn mt-3 px-4 py-2" disabled={busy || !payload.trim()} onClick={()=>void stage()}>Validate &amp; Stage Draft</button>
    </details>

    <div className="panel-soft mt-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">Versioned backups</h3><p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>A full snapshot of semester.json, courses.json, majors.json and sch.json is stored before every Sync publish. Daily Sync never edits semester/major structure.</p></div>{backups[0] && <button className="btn px-3 py-2 text-xs" disabled={busy || !restoreReason.trim()} onClick={()=>void restore(backups[0], true)}>Rollback Latest</button>}</div>
      {backups.length > 0 && <label className="mt-3 block text-xs font-semibold">Restore / rollback reason<input className="select mt-1" maxLength={240} value={restoreReason} onChange={event=>setRestoreReason(event.target.value)} placeholder="e.g. Wrong room changes were published; restoring last verified snapshot" /></label>}
      {backups.length === 0 ? <p className="mt-3 text-sm">No Sync backups yet.</p> : <div className="mt-3 space-y-2">{backups.map((version,index)=><div className="flex flex-wrap items-center justify-between gap-2" key={version}><div><code className="text-xs">{version}</code>{index === 0 && <span className="pill ml-2">Latest</span>}</div><div className="flex gap-2"><button className="btn px-3 py-2 text-xs" disabled={busy} onClick={()=>void downloadBackup(version)}>Download Backup</button><button className="btn px-3 py-2 text-xs" disabled={busy || !restoreReason.trim()} onClick={()=>void restore(version)}>Restore</button></div></div>)}</div>}
    </div>
    {message && <p className="mt-3 text-sm" role="status" style={{ color: 'var(--warn)' }}>{message}</p>}
  </section>;
}
