import type { Course, MeetingType } from '../types';

export type TypeFilter = 'All' | MeetingType;

const TYPE_CHIPS: { value: TypeFilter; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'Lecture', label: 'Lectures' },
  { value: 'Lab', label: 'Labs' },
  { value: 'Tutorial', label: 'Tutorials' },
];

export function CombinationNav({
  index,
  count,
  onPrev,
  onNext,
  onSuggest,
  isBest,
  bestIsComplete = true,
}: {
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  onSuggest: () => void;
  isBest: boolean;
  /** False when the bounded best-scan stopped early — the badge must not claim full optimality. */
  bestIsComplete?: boolean;
}) {
  const disabled = count === 0;
  return (
    <div className="panel no-print p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <button type="button" className="btn" onClick={onPrev} disabled={disabled} aria-label="Previous combination">
            ‹ Prev
          </button>
          <div
            className="mono min-w-[168px] rounded-lg px-3 py-2 text-center text-[12px] font-semibold"
            style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)' }}
            aria-live="polite"
          >
            {disabled ? 'Combination 0 of 0' : `Combination ${index + 1} of ${count.toLocaleString()}`}
          </div>
          <button type="button" className="btn" onClick={onNext} disabled={disabled} aria-label="Next combination">
            Next ›
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 sm:justify-end">
          {isBest && (
            <span
              className="pill"
              style={{ color: 'var(--ok)', borderColor: 'color-mix(in srgb, var(--ok) 40%, var(--line))' }}
            >
              ✓ best ranked{bestIsComplete ? '' : ' (of scanned set)'}
            </span>
          )}
          <button type="button" className="btn btn-accent" onClick={onSuggest} disabled={disabled}>
            ✦ Suggest Best Combination
          </button>
        </div>
      </div>
    </div>
  );
}

export function Filters({
  typeFilter,
  onTypeFilter,
  courseFilter,
  onCourseFilter,
  courses,
}: {
  typeFilter: TypeFilter;
  onTypeFilter: (t: TypeFilter) => void;
  courseFilter: string;
  onCourseFilter: (id: string) => void;
  courses: Course[];
}) {
  return (
    <div className="panel no-print flex flex-wrap items-center gap-2 p-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-2)' }}>
        Filter
      </span>
      <div
        className="flex flex-wrap items-center gap-1 rounded-xl p-1"
        style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)' }}
        role="group"
        aria-label="Filter by meeting type"
      >
        {TYPE_CHIPS.map((chip) => {
          const active = typeFilter === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => onTypeFilter(chip.value)}
              aria-pressed={active}
              className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
              style={{
                background: active ? 'var(--paper)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--muted)',
                border: active ? '1px solid var(--line)' : '1px solid transparent',
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="ml-auto w-full sm:w-[220px]">
        <label className="sr-only" htmlFor="course-filter">
          Filter by course
        </label>
        <select id="course-filter" className="select" value={courseFilter} onChange={(e) => onCourseFilter(e.target.value)}>
          <option value="all">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
