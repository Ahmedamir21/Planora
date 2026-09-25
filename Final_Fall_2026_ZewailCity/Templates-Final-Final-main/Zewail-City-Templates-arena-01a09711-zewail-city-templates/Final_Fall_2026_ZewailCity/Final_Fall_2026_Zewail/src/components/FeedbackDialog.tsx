import { useEffect, useState, type FormEvent } from 'react';

const categories = ['Ease of use', 'Schedule generator', 'AI assistant', 'Design & mobile', 'Feature idea', 'Other'] as const;

export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<typeof categories[number]>('Ease of use');
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || rating === null) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, rating, message: message.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Feedback could not be delivered.');
      setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Feedback could not be delivered.'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/65 p-3 sm:p-6" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel max-h-[92vh] w-full max-w-[540px] overflow-y-auto p-5 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      <div className="flex items-start justify-between gap-3"><div><h2 id="feedback-title" className="text-lg font-bold">Feedback for Planora</h2><p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Tell the Planora creators what works and what could be better. Feedback is private to the admins.</p></div><button type="button" className="btn" aria-label="Close feedback" onClick={onClose}>✕</button></div>
      {sent ? <div className="mt-5" role="status"><p>Thanks! Your feedback reached the Planora admins.</p><button className="btn mt-4" type="button" onClick={onClose}>Close</button></div> : <form className="mt-5 grid gap-4" onSubmit={event => void submit(event)}>
        <label className="text-sm font-semibold">About what?<select className="select mt-1" value={category} onChange={event => setCategory(event.target.value as typeof category)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
        <fieldset><legend className="mb-2 text-sm font-semibold">Rate Planora from 1 to 10</legend><div className="grid grid-cols-5 gap-2 sm:grid-cols-10">{Array.from({ length: 10 }, (_, index) => index + 1).map(value => <button key={value} type="button" className={`btn px-2 py-2 ${rating === value ? 'btn-accent' : ''}`} aria-label={`${value} out of 10`} aria-pressed={rating === value} onClick={() => setRating(value)}>{value}</button>)}</div></fieldset>
        <label className="text-sm font-semibold">Your comments (optional)<textarea maxLength={1200} className="select mt-1 min-h-28 resize-y" value={message} onChange={event => setMessage(event.target.value)} placeholder="What helped? What should we improve? You can leave this blank." /></label>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Please avoid names, student IDs and other personal information. For wrong course data, use “Report an issue” instead.</p>
        {error && <p role="alert" className="text-sm" style={{ color: 'var(--warn)' }}>{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-accent" type="submit" disabled={busy || rating === null}>{busy ? 'Sending…' : 'Send feedback'}</button></div>
      </form>}
    </section>
  </div>;
}
