import { useMemo } from 'react';
import type { Course } from '../types';
import { dataCompleteness } from '../lib/dataCompleteness';

export function AdminDataCompleteness({ courses }: { courses: Course[] }) {
  const gaps = useMemo(() => dataCompleteness(courses), [courses]);
  const rooms = gaps.filter(gap => gap.issue === 'Room missing').length;
  return <section className="panel p-5" aria-labelledby="data-gaps-heading">
    <h2 id="data-gaps-heading" className="text-lg font-bold">Published section completeness</h2>
    <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Published courses and sections only. A blank room still needs source review: this check cannot tell whether it was never published or was missed during extraction.</p>
    <p className="mt-3 text-sm font-semibold" role="status">{rooms} meetings without a room · {gaps.length - rooms} meetings without an assigned instructor</p>
    {gaps.length > 0 && <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Show every missing field</summary>
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">{gaps.map((gap, index) => <li key={index}>{gap.course} · {gap.component} {gap.section}: {gap.issue}</li>)}</ul>
    </details>}
  </section>;
}
