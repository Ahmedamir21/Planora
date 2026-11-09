import { useCallback, useEffect, useState } from 'react';

type Feedback = { id: string; at: string; category: string; rating: number | null; message: string; reporterName?: string; status: string; note?: string; reviewedAt?: string; reviewedBy?: string };
type Summary = { total: number; newCount: number; last7Days: number; averageRating: number | null; ratingCount: number; categories: Record<string, number> };

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Feedback inbox is unavailable.');
  return result;
}

export function AdminFeedback({ onReviewed }: { onReviewed: () => void }) {
  const [items, setItems] = useState<Feedback[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [category, setCategory] = useState('All categories');
  const [status, setStatus] = useState('All statuses');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    const result = await request('/api/admin?action=feedback');
    setItems(result.items || []); setSummary(result.summary); setError('');
  }, []);
  useEffect(() => {
    const refresh = () => void reload().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load feedback.'));
    refresh(); const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
  }, [reload]);

  const review = async (item: Feedback, nextStatus: string) => {
    const note = notes[item.id]?.trim();
    if (!note) { setError('Add a short review note first.'); return; }
    setBusy(true); setError('');
    try {
      await request('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'review_feedback', id: item.id, status: nextStatus, note }) });
      setNotes(previous => ({ ...previous, [item.id]: '' }));
      await reload(); onReviewed();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not review feedback.'); }
    finally { setBusy(false); }
  };
  const filtered = items.filter(item => (category === 'All categories' || item.category === category) && (status === 'All statuses' || item.status === status));
  const topCategory = summary && Object.entries(summary.categories).sort((a, b) => b[1] - a[1])[0];

  return <section className="panel p-5" aria-labelledby="feedback-heading">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="feedback-heading" className="text-lg font-bold">Student feedback {summary && summary.newCount > 0 && <span className="pill ml-2" role="status">{summary.newCount} new</span>}</h2><button className="btn px-3 py-2" onClick={() => void reload().catch(cause => setError(String(cause)))}>Refresh feedback</button></div>
    <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Private feedback from students. Summary is calculated from the actual submissions, including archived feedback; it is not an AI guess.</p>
    {summary && <><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[[String(summary.total), 'Total'], [String(summary.newCount), 'Needs review'], [String(summary.last7Days), 'Last 7 days'], [summary.averageRating === null ? '—' : `${summary.averageRating} / 10`, `Average rating (${summary.ratingCount})`]].map(([value, label]) => <div key={label} className="panel-soft p-3"><strong className="text-xl" style={{ color: 'var(--accent)' }}>{value}</strong><p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p></div>)}</div><p className="mt-3 text-sm">{summary.total ? `Most mentioned category: ${topCategory?.[0]} (${topCategory?.[1]}).` : 'No feedback to summarize yet.'}</p><div className="mt-2 flex flex-wrap gap-2">{Object.entries(summary.categories).map(([name, count]) => <span className="pill" key={name}>{name}: {count}</span>)}</div></>}
    <div className="mt-4 flex flex-wrap gap-2"><label className="text-xs">Category<select className="select mt-1" value={category} onChange={event => setCategory(event.target.value)}><option>All categories</option>{Object.keys(summary?.categories || {}).map(name => <option key={name}>{name}</option>)}</select></label><label className="text-xs">Status<select className="select mt-1" value={status} onChange={event => setStatus(event.target.value)}><option>All statuses</option><option value="new">New</option><option value="reviewed">Reviewed</option><option value="archived">Archived</option></select></label></div>
    {error && <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--warn)' }}>{error}</p>}
    <div className="mt-4 space-y-3">{filtered.map(item => <article className="panel-soft p-4" key={item.id}><p className="font-semibold">{item.category} · {item.rating} / 10 <span className="pill">{item.status}</span></p><p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{new Date(item.at).toLocaleString()} · From: {item.reporterName || 'Anonymous'}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm">{item.message || 'Rating only · no written comment'}</p>{item.note && <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>Reviewed by {item.reviewedBy}: {item.note}</p>}<div className="mt-3 flex flex-wrap items-center gap-2"><input className="select min-w-40 flex-1" aria-label={`Review note for feedback ${item.id}`} maxLength={500} placeholder="Admin note (required)" value={notes[item.id] || ''} onChange={event => setNotes(previous => ({ ...previous, [item.id]: event.target.value }))} /><button className="btn px-3 py-2" disabled={busy} onClick={() => void review(item, 'reviewed')}>Mark reviewed</button><button className="btn px-3 py-2" disabled={busy} onClick={() => void review(item, 'archived')}>Archive</button>{item.status !== 'new' && <button className="btn px-3 py-2" disabled={busy} onClick={() => void review(item, 'new')}>Reopen</button>}</div></article>)}{filtered.length === 0 && <p className="text-sm" style={{ color: 'var(--muted)' }}>No feedback matches these filters.</p>}</div>
  </section>;
}
