import { useEffect } from 'react';
import { DAYS, formatDuration, formatRange, to12h } from '../lib/time';
import type { GeneratedSchedule } from '../lib/bestSchedule';
import { meetingOption } from '../lib/picks';

interface Props {
  schedules: GeneratedSchedule[];
  labels: string[];
  onClose: () => void;
  onUse: (schedule: GeneratedSchedule) => void;
}

interface Row {
  label: string;
  values: (s: GeneratedSchedule) => string;
  /** Index of the schedule(s) with the unambiguously better value for this row, if any. */
  better?: (schedules: GeneratedSchedule[]) => number[];
}

const ROWS: Row[] = [
  { label: 'Courses', values: (s) => String(s.perCourse.length) },
  { label: 'Credits', values: (s) => String(s.credits) },
  {
    label: 'Free Days',
    values: (s) => String(5 - s.metrics.days),
    better: (list) => bestIndices(list.map((s) => 5 - s.metrics.days), 'max'),
  },
  {
    label: 'Total Gaps',
    values: (s) => formatDuration(s.metrics.gapMinutes),
    better: (list) => bestIndices(list.map((s) => s.metrics.gapMinutes), 'min'),
  },
  { label: 'Conflicts', values: () => '0' },
  {
    label: 'Busiest Day',
    values: (s) => formatDuration(s.maxDayMinutes),
    better: (list) => bestIndices(list.map((s) => s.maxDayMinutes), 'min'),
  },
  {
    label: 'Daily Hours',
    values: (s) => dailyHoursLabel(s),
  },
  { label: 'Earliest Start', values: (s) => (s.metrics.earliest != null ? to12h(s.metrics.earliest) : '—') },
  { label: 'Latest Finish', values: (s) => (s.metrics.latest != null ? to12h(s.metrics.latest) : '—') },
  {
    label: 'Preference Score',
    values: (s) => `${s.scorePercent}%`,
    better: (list) => bestIndices(list.map((s) => s.scorePercent), 'max'),
  },
];

function bestIndices(values: number[], mode: 'min' | 'max'): number[] {
  if (values.length === 0) return [];
  const target = mode === 'min' ? Math.min(...values) : Math.max(...values);
  if (values.every((v) => v === target)) return []; // all tied — nothing to highlight
  return values.reduce<number[]>((acc, v, i) => (v === target ? [...acc, i] : acc), []);
}

/** Version B's headline badges: which candidate wins the headline metrics overall. */
function summaryBadges(list: GeneratedSchedule[], i: number): string[] {
  if (list.length < 2) return [];
  const out: string[] = [];
  if (bestIndices(list.map((s) => s.scorePercent), 'max').includes(i)) out.push('★ Best');
  if (bestIndices(list.map((s) => s.metrics.gapMinutes), 'min').includes(i)) out.push('⚡ Min gaps');
  if (bestIndices(list.map((s) => s.metrics.days), 'min').includes(i)) out.push('🗓 Fewest days');
  return out;
}

function Badges({ schedules, index }: { schedules: GeneratedSchedule[]; index: number }) {
  const badges = summaryBadges(schedules, index);
  if (badges.length === 0) return null;
  return (
    <span className="mt-0.5 flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={b}
          className="pill !px-2 !py-0.5 !text-[10px]"
          style={{ color: 'var(--ok)', borderColor: 'color-mix(in srgb, var(--ok) 40%, var(--line))' }}
        >
          {b}
        </span>
      ))}
    </span>
  );
}

function componentInstructorLabel(entry: GeneratedSchedule['perCourse'][number]): string {
  const parts = entry.pairing.meetings.map((meeting) => {
    const instructor = meetingOption(entry.course, meeting)?.instructor ?? entry.instructor;
    const name = instructor?.unassigned ? 'Unassigned' : instructor?.name ?? entry.instructor.name;
    return `${meeting.type}: ${name}`;
  });
  return Array.from(new Set(parts)).join(' · ');
}

export function CompareSchedules({ schedules, labels, onClose, onUse }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Compare schedules"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel max-h-[90vh] w-full max-w-[760px] overflow-y-auto rounded-b-none p-4 sm:rounded-2xl sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[14.5px] font-bold tracking-tight">Compare Schedules</h2>
            <p className="mt-0.5 text-[11.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              ★ marks the clearly better value for that row. Earliest start / latest finish are shown for reference
              only — which one suits you is a matter of preference.
            </p>
          </div>
          <button type="button" className="btn px-2.5 py-1.5 btn-tap" onClick={onClose} aria-label="Close comparison">
            ✕
          </button>
        </div>

        {/* Desktop / tablet: table */}
        <div className="mt-4 hidden overflow-x-auto sm:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="w-[140px] pb-2 text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--muted-2)' }}>
                  Metric
                </th>
                {schedules.map((s, i) => (
                  <th key={s.id} className="pb-2 text-left text-[13px] font-extrabold" style={{ color: 'var(--accent)' }}>
                    {labels[i]}
                    <Badges schedules={schedules} index={i} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const better = row.better ? row.better(schedules) : [];
                return (
                  <tr key={row.label} style={{ borderTop: '1px solid var(--line-soft)' }}>
                    <td className="py-2 pr-2 text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                      {row.label}
                    </td>
                    {schedules.map((s, i) => (
                      <td key={s.id} className="mono py-2 pr-2 text-[13px] font-bold">
                        <span style={{ color: better.includes(i) ? 'var(--ok)' : 'var(--ink)' }}>
                          {better.includes(i) && '★ '}
                          {row.values(s)}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked cards, one per schedule */}
        <div className="mt-4 space-y-3 sm:hidden">
          {schedules.map((s, i) => {
            return (
              <div key={s.id} className="panel-soft p-3.5">
                <h3 className="text-[13.5px] font-extrabold" style={{ color: 'var(--accent)' }}>
                  {labels[i]}
                  <Badges schedules={schedules} index={i} />
                </h3>
                <dl className="mt-2 grid grid-cols-2 gap-y-1.5 text-[12px]">
                  {ROWS.map((row) => {
                    const better = row.better ? row.better(schedules) : [];
                    return (
                      <div key={row.label} className="contents">
                        <dt style={{ color: 'var(--muted)' }}>{row.label}</dt>
                        <dd className="mono text-right font-bold" style={{ color: better.includes(i) ? 'var(--ok)' : 'var(--ink)' }}>
                          {better.includes(i) && '★ '}
                          {row.values(s)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            );
          })}
        </div>

        {/* Per-schedule section breakdown — what actually changes between these options. */}
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {schedules.map((s, i) => (
            <div key={s.id} className="panel-soft p-3">
              <h3 className="text-[12px] font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
                {labels[i]} — sections
              </h3>
              <ul className="mt-1.5 space-y-1">
                {s.perCourse.map((e) => (
                  <li key={e.course.id} className="text-[11px] leading-snug" style={{ color: 'var(--muted)' }}>
                    <span className="mono font-bold" style={{ color: `var(--c${e.course.c})` }}>
                      {e.course.code}
                    </span>{' '}
                    · {componentInstructorLabel(e)}
                    <span className="block" style={{ color: 'var(--muted-2)' }}>
                      {e.pairing.meetings.map((m) => `${m.type[0]}${m.sec} ${m.day} ${formatRange(m.start, m.end)}`).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end" style={{ borderColor: 'var(--line-soft)' }}>
          {schedules.map((s, i) => (
            <button key={s.id} type="button" className="btn btn-accent btn-tap" onClick={() => onUse(s)}>
              Use {labels[i]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Exact class minutes per day (end − start, summed), compact for a table cell. */
function dailyHoursLabel(s: GeneratedSchedule): string {
  const perDay = new Map<string, number>();
  s.meetings.forEach((m) => perDay.set(m.day, (perDay.get(m.day) ?? 0) + (m.end - m.start)));
  const parts = DAYS.filter((d) => (perDay.get(d) ?? 0) > 0).map((d) => `${d} ${formatDuration(perDay.get(d)!)}`);
  return parts.length ? parts.join(' · ') : '—';
}
