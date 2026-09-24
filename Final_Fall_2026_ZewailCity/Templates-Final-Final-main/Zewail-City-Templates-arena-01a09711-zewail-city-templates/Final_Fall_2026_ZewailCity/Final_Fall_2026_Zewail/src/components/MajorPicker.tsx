import type { Major } from '../types';
import { COURSE_BY_ID } from '../data/courses';
import { MAJORS } from '../data/majors';

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  compact?: boolean;
}

export function MajorPicker({ selectedId, onSelect, compact = false }: Props) {
  return (
    <div
      className={
        compact
          ? 'grid gap-2 sm:grid-cols-3'
          : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
      }
    >
      {MAJORS.map((major) => (
        <MajorCard key={major.id} major={major} selected={selectedId === major.id} onSelect={() => onSelect(major.id)} compact={compact} />
      ))}
    </div>
  );
}

function MajorCard({
  major,
  selected,
  onSelect,
  compact,
}: {
  major: Major;
  selected: boolean;
  onSelect: () => void;
  compact: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
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
            {major.subtitle}
          </p>
          <h3 className={`mt-1 truncate font-bold tracking-tight ${compact ? 'text-[13.5px]' : 'text-[16px]'}`}>
            {major.title}
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
        <>
          <p className="mt-2 text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            {major.blurb}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {/* Same chips as before the year split: the major's first year (Year 2) list. */}
            {major.years[0].courseIds.map((id) => {
              const course = COURSE_BY_ID[id];
              return (
                <span
                  key={id}
                  className="mono rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
                  style={{
                    color: `var(--c${course.c})`,
                    background: `var(--c${course.c}-bg)`,
                  }}
                >
                  {course.code}
                </span>
              );
            })}
          </div>
        </>
      )}
    </button>
  );
}
