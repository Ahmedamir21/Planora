import { useState } from 'react';
import type { Course } from '../types';
import type { AuditCheck } from '../lib/engineAudit';

export function AdminEngineAudit({ courses }: { courses: Course[] }) {
  const [checks, setChecks] = useState<AuditCheck[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setRunning(true);
    setError('');
    try {
      const { runEngineAudit } = await import('../lib/engineAudit');
      // Only run this heavier catalog-wide audit when an authenticated admin requests it.
      setChecks(runEngineAudit(courses));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Audit could not complete.');
    } finally {
      setRunning(false);
    }
  }

  const passed = checks?.filter((check) => check.passed).length ?? 0;
  return <section className="panel p-5" aria-labelledby="engine-audit-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="engine-audit-heading" className="text-lg font-bold">Scheduling engine audit</h2><p className="text-xs" style={{ color: 'var(--muted)' }}>Checks the published catalog. Run again after the deployed data changes; private drafts are checked separately in the editor.</p></div>
      <button className="btn px-4 py-2" type="button" disabled={running} onClick={() => void run()}>{running ? 'Checking…' : checks ? 'Run checks again' : 'Run 16 checks'}</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--warn)' }}>{error}</p>}
    {checks && <div className="mt-4" role="status">
      <p className="font-semibold" style={{ color: passed === checks.length ? 'var(--ok)' : 'var(--warn)' }}>{passed}/{checks.length} checks passed</p>
      <div className="mt-3 space-y-2">{checks.map((check) => <details key={check.title} className="panel-soft p-3">
        <summary className="cursor-pointer text-sm font-semibold"><span style={{ color: check.passed ? 'var(--ok)' : 'var(--warn)' }}>{check.passed ? '✓' : '✕'}</span> {check.title}</summary>
        <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>{check.detail}</p>
      </details>)}</div>
    </div>}
  </section>;
}
