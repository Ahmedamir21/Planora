import { useEffect, useState } from 'react';

type Entry = { id: string; at: string; action: string; ip: string; device: string; claimedUsername: string; adminName?: string };

export function AdminSecurityLog() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState('');
  async function refresh() {
    try {
      const response = await fetch('/api/admin?action=security', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load the private security log.');
      const data = await response.json();
      if (!data.authenticated && !Array.isArray(data.entries)) throw new Error('Sign in again to view security events.');
      setEntries(data.entries || []); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Security log unavailable.'); }
  }
  useEffect(() => { void refresh(); }, []);
  return <section className="panel p-5" aria-labelledby="admin-security-heading">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="admin-security-heading" className="text-lg font-bold">Admin sign-in security</h2><button type="button" className="btn px-3 py-2" onClick={() => void refresh()}>Refresh events</button></div>
    <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Private log, latest 200 events or 30 days. Failed usernames are claims typed by visitors; browser and OS are approximate user-agent labels, not verified identities.</p>
    {error && <p className="mt-2 text-xs" role="alert">{error}</p>}
    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{entries.map(entry => <article className="panel-soft p-3 text-xs" key={entry.id}>
      <strong>{entry.action === 'login_success' ? `Successful sign-in · ${entry.adminName}` : entry.action === 'login_blocked' ? 'Rate-limited sign-in attempt' : 'Failed sign-in attempt'}</strong>
      <p>{new Date(entry.at).toLocaleString()} · IP: {entry.ip} · {entry.device}</p>
      <p>Username entered: {entry.claimedUsername || '(empty)'}</p>
    </article>)}{!entries.length && !error && <p className="text-xs">No recorded attempts yet.</p>}</div>
  </section>;
}
