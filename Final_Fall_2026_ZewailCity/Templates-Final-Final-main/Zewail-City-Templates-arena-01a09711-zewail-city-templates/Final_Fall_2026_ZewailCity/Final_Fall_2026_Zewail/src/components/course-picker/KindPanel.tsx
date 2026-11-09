import type { Course, Instructor, MeetingType } from '../../types';
import { isOptionDisabled, summarizeHidden, type OptionState } from '../../lib/picks';
import { isComponentLocked, type PlannerLocks } from '../../lib/assistantControls';
import { OptionRow } from './OptionRow';
import { KIND_ICON } from './kinds';

/** One box of times for a single kind (lecture, lab or tutorial) inside a course card. */
export function KindPanel({
  kind,
  states,
  course,
  instructor,
  expanded,
  onToggleExpanded,
  onChoose,
  locks,
  onToggleComponentLock,
}: {
  kind: MeetingType;
  states: OptionState[];
  course: Course;
  instructor: Instructor | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onChoose: (kind: MeetingType, key: string, optionInstructor: number) => void;
  locks: PlannerLocks;
  onToggleComponentLock: (kind: MeetingType) => void;
}) {
  if (states.length === 0) return null;
  // Selected items must remain visible whatever the filters say; everything that is
  // hidden or blocked moves into the expandable "Why is this hidden?" group.
  const visible = states.filter((s) => !s.hiddenByInstructor && !s.disabledByConflict && s.hardReasons.length === 0);
  const unavailable = states.filter((s) => s.hiddenByInstructor || s.disabledByConflict || s.hardReasons.length > 0);
  const summary = summarizeHidden(states);
  return (
    <div className="panel-soft p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--muted-2)' }}>
          <span aria-hidden>{KIND_ICON[kind]}</span>
          {kind === 'Lecture' ? 'Pick a lecture time' : `Pick a ${kind.toLowerCase()} time`}
        </p>
        {summary.hidden > 0 && (
          <span
            className="text-[10px] font-bold"
            style={{ color: summary.conflicts > 0 ? 'var(--warn)' : 'var(--muted-2)' }}
          >
            {summary.hidden} hidden{summary.conflicts > 0 ? ` • ${summary.conflicts} conflict${summary.conflicts > 1 ? 's' : ''}` : ''}
          </span>
        )}
      </div>

      {visible.length === 0 && unavailable.length === 0 ? (
        <p className="mt-1.5 text-[11.5px] leading-snug" style={{ color: 'var(--warn)' }}>
          No {kind.toLowerCase()} published under {instructor?.name}. Nothing is invented for them.
        </p>
      ) : (
        <div className="mt-1 space-y-1">
          {visible.map((option) => (
            <OptionRow
              key={option.key}
              option={option}
              course={course}
              groupLabel={instructor?.name}
              onSelect={() => onChoose(kind, option.key, option.instructorIdx)}
              showReasons={isOptionDisabled(option)}
              locked={isComponentLocked(locks, course.id, kind)}
              onToggleLock={() => onToggleComponentLock(kind)}
            />
          ))}
          {expanded &&
            unavailable.map((option) => (
              <OptionRow
                key={'hid' + option.key}
                option={option}
                course={course}
                groupLabel={instructor?.name}
                onSelect={() => onChoose(kind, option.key, option.instructorIdx)}
                showReasons
                locked={isComponentLocked(locks, course.id, kind)}
                onToggleLock={() => onToggleComponentLock(kind)}
              />
            ))}
        </div>
      )}

      {unavailable.length > 0 && (
        <div className="mt-1.5">
          <button
            type="button"
            className="btn-tap w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold"
            style={{ background: 'var(--surface)', color: 'var(--muted)' }}
            onClick={() => onToggleExpanded()}
            aria-expanded={expanded}
          >
            {expanded ? '▾ Hide' : `▸ Why is this hidden? (${unavailable.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
