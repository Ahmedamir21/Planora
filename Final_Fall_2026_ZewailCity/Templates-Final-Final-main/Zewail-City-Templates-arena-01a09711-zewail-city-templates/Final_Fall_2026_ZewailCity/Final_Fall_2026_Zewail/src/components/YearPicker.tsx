
import type { Major } from '../types';
import { COURSE_BY_ID } from '../data/courses';

interface Props {
  major: Major;
  selectedYearId: string | null;
  onSelect: (yearId: string) => void;
  compact?: boolean;
}

/**
 * Year selection step — shown right after a major is picked, before the course picker.
 * Mirrors the MajorPicker card pattern: one selectable card per YearPlan
 * (Year 1 / Year 2 / Year 3 / Year 4).
 */
export function YearPicker({ major, selectedYearId, onSelect, compact = false }: Props) {
  return (
    <div className={compact ? 'grid gap-2 sm:grid-cols-2 lg:grid-cols-4' : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'}>
      {major.years.map((year) => {
        const selected = selectedYearId === year.id;
        return (
          <button
            key={year.id}
            type="button"
            onClick={() => onSelect(year.id)}
            aria-pressed={selected}
            className="group text-left transition-all"
            style={{
              borderRadius: 14,
              border: `1px solid ${selected ? 'var(--accent)' : 'var(--line)'}`,
              background: selected ? 'color-mix(in srgb, var(--accent) 10%, var(--paper))' : 'var(--paper)',
              boxShadow: selected ? 'inset 0 0 0 1px var(--accent), var(--shadow)' : 'none',
              padding: compact ? '10px 12px' : '16px',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="truncate text-[10px] font-bold uppercase tracking-[0.09em]"
                  style={{ color: selected ? 'var(--accent)' : 'var(--muted-2)' }}
                >
                  {year.courseIds.length} course{year.courseIds.length === 1 ? '' : 's'}
                </p>
                <h3 className={`mt-1 truncate font-bold tracking-tight ${compact ? 'text-[13.5px]' : 'text-[15px]'}`}>
                  {year.label}
                </h3>
              </div>
              <span
                className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border transition-colors"
                style={{
                  borderColor: selected ? 'var(--accent)' : 'var(--line)',
                  background: selected ? 'var(--accent)' : 'transparent',
                }}
                aria-hidden
              >
                {selected && (
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="var(--accent-ink)" strokeWidth={3.5}>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            </div>

            {!compact && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {year.courseIds.map((id) => {
                  const course = COURSE_BY_ID[id];
                  if (!course) return null;
                  return (
                    <span
                      key={id}
                      className="mono rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
                      style={{ color: `var(--c${course.c})`, background: `var(--c${course.c}-bg)` }}
                    >
                      {course.code}
                    </span>
                  );
                })}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
