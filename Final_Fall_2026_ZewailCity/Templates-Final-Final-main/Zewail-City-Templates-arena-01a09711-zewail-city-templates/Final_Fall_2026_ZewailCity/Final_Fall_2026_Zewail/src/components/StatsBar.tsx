import type { ComboMetrics } from '../types';
import { to12h } from '../lib/time';

function fmtMinutes(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m` : ''}`.trim();
}

export function StatsBar({
  metrics,
  courseCount,
  comboCount,
  truncated,
  countCapped = false,
}: {
  metrics: ComboMetrics;
  courseCount: number;
  comboCount: number;
  truncated: boolean;
  /** True when even the budgeted recount stopped — the number shown is a floor. */
  countCapped?: boolean;
}) {
  const tiles: { label: string; value: string; hint?: string }[] = [
    { label: 'Courses', value: String(courseCount) },
    { label: 'Scheduled sessions', value: String(metrics.sessions) },
    { label: 'Campus days', value: String(metrics.days), hint: 'of 5 teaching days' },
    { label: 'Free days', value: String(Math.max(0, 5 - metrics.days)) },
    { label: 'Earliest start', value: metrics.earliest != null ? to12h(metrics.earliest) : '—' },
    { label: 'Latest finish', value: metrics.latest != null ? to12h(metrics.latest) : '—' },
    { label: 'Idle time on campus', value: fmtMinutes(metrics.gapMinutes), hint: 'gaps between sessions' },
    { label: 'Daily span', value: fmtMinutes(metrics.spanMinutes), hint: 'first start → last end' },
    {
      label: 'Valid combinations',
      value: countCapped ? `${comboCount.toLocaleString()}+` : comboCount.toLocaleString(),
      hint: countCapped
        ? 'more exist — counting was budgeted to keep the UI responsive'
        : truncated
          ? 'more than fit in browser storage — top results still ranked'
          : 'for this selection',
    },
  ];

  return (
    <section className="panel p-4 sm:p-5" aria-label="Schedule statistics">
      <h2 className="text-[13px] font-bold tracking-tight">Schedule Statistics</h2>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--muted)' }}>
        Calculated from the actual meetings in the combination above.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="panel-soft px-3 py-2.5">
            <dt className="text-[10px] font-bold uppercase tracking-[0.07em]" style={{ color: 'var(--muted-2)' }}>
              {t.label}
            </dt>
            <dd className="mono mt-1 text-[15px] font-bold leading-none" style={{ color: 'var(--ink)' }}>
              {t.value}
            </dd>
            {t.hint && (
              <dd className="mt-1 text-[10.5px] leading-snug" style={{ color: 'var(--muted-2)' }}>
                {t.hint}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
