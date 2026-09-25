import { useEffect, useState, type FormEvent } from 'react';
import type { Course } from '../types';
import type { Pick } from '../lib/picks';
import { courseIssueText } from '../lib/reportIssue';

const ISSUE_TYPES = ['Course name', 'Instructor name', 'Day or time', 'Room', 'Section', 'Credits', 'Other'] as const;

export function ReportIssueDialog({ course, pick, onClose }: {
  course?: Course;
  pick?: Pick;
  onClose: () => void;
}) {
  const [types, setTypes] = useState<string[]>([]);
  const [courseCode, setCourseCode] = useState(course?.code ?? '');
  const [component, setComponent] = useState('');
  const [section, setSection] = useState('');
  const [details, setDetails] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (types.length === 0 || !details.trim() || busy) return;
    setBusy(true); setError('');
    try {
    const response = await fetch('/api/reports', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      types,
      courseCode: courseCode.trim(),
      component,
      section: section.trim(),
      details: details.trim(),
      reporterName: reporterName.trim(),
      publishedData: course ? courseIssueText(course, pick).split('\nIssue found:')[0] : '',
    }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not deliver the report.');
    setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not deliver the report.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/65 p-3 sm:p-6" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="report-title" className="panel max-h-[92vh] w-full max-w-[560px] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="report-title" className="text-lg font-bold">Report incorrect data</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              Select everything that needs fixing. Your report goes straight to Planora’s private admin inbox; no account is needed.
            </p>
          </div>
          <button type="button" className="btn" onClick={onClose} aria-label="Cancel report">✕</button>
        </div>

        {sent ? <div className="mt-5" role="status"><p>Your report was delivered to the Planora admins. Thank you.</p><button className="btn mt-4" onClick={onClose}>Close</button></div> : <form onSubmit={event => void submit(event)} className="mt-5 grid gap-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">What is wrong? Select one or more.</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ISSUE_TYPES.map((type) => (
                <label key={type} className="panel-soft flex cursor-pointer items-center gap-2 px-3 py-2 text-xs">
                  <input type="checkbox" checked={types.includes(type)} onChange={(event) => setTypes((current) => event.target.checked ? [...current, type] : current.filter((item) => item !== type))} />
                  {type}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold">Course code (if relevant)
              <input className="select mt-1" style={{ backgroundImage: 'none', paddingRight: 12 }} value={courseCode} onChange={(event) => setCourseCode(event.target.value)} placeholder="e.g. CSAI 101" />
            </label>
            <label className="text-xs font-semibold">Component
              <select className="select mt-1" value={component} onChange={(event) => setComponent(event.target.value)}>
                <option value="">Not sure / general</option>
                <option>Lecture</option><option>Lab</option><option>Tutorial</option>
              </select>
            </label>
            <label className="text-xs font-semibold">Section (if relevant)
              <input className="select mt-1" style={{ backgroundImage: 'none', paddingRight: 12 }} value={section} onChange={(event) => setSection(event.target.value)} placeholder="e.g. 02" />
            </label>
          </div>

          <label className="text-xs font-semibold">What should be corrected? <span aria-hidden="true">*</span>
            <textarea className="select mt-1 min-h-28 resize-y" style={{ backgroundImage: 'none', paddingRight: 12 }} required maxLength={1500} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Tell us what the site shows and what you believe is correct. Add a Self-Service reference if you have one." />
          </label>
          <label className="text-xs font-semibold">Name or nickname (optional)
            <input className="select mt-1" maxLength={60} value={reporterName} onChange={event => setReporterName(event.target.value)} placeholder="Leave blank to report anonymously" autoComplete="off" />
          </label>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>You can report anonymously. Please leave student IDs, contact details and other personal information out of the report. Only Planora admins can view it.</p>
          {error && <p role="alert" className="text-sm" style={{ color: 'var(--warn)' }}>{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-accent" disabled={busy || types.length === 0 || !details.trim()}>{busy ? 'Sending…' : 'Send report to admins'}</button>
          </div>
        </form>}
      </section>
    </div>
  );
}
