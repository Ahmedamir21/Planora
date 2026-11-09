import { useState } from 'react';
import type { Course, MeetingType } from '../../types';
import {
  emptyPick,
  mergeHiddenSummaries,
  optionStates,
  summarizeHidden,
  type OptionState,
  type Pick,
  type PickState,
} from '../../lib/picks';
import type { SchedulePreferences } from '../../lib/preferences';
import { isFullyLocked, type PlannerLocks } from '../../lib/assistantControls';
import { Icon } from '../Icon';
import { FilterPill } from './FilterPill';
import { KindPanel } from './KindPanel';
import { KIND_ORDER, countableKinds } from './kinds';

export function CourseCard({
  course,
  pick,
  takenCourses,
  picks,
  pinnedInstructorIdx,
  onInstructorFilter,
  preferences,
  onChange,
  onToggle,
  onClearOne,
  yearBadge,
  shakeNonce,
  onHoverCourse,
  locks,
  onToggleCourseLock,
  onToggleComponentLock,
  onReportIssue,
}: {
  course: Course;
  pick: Pick | undefined;
  takenCourses: Course[];
  picks: PickState;
  pinnedInstructorIdx: number | null;
  onInstructorFilter: (idx: number | null) => void;
  preferences?: SchedulePreferences;
  onChange: (next: Pick) => void;
  onToggle: (taking: boolean) => void;
  onClearOne: () => void;
  /** "Year X" label when the course came from another year of the major. */
  yearBadge?: string;
  /** Non-null triggers the rejected-addition shake; changes retrigger it. */
  shakeNonce?: number | null;
  onHoverCourse?: (courseId: string | null) => void;
  locks: PlannerLocks;
  onToggleCourseLock: () => void;
  onToggleComponentLock: (kind: MeetingType) => void;
  onReportIssue: () => void;
}) {
  const taking = !!pick;
  const fullyLocked = isFullyLocked(course, pick, locks);
  // No published schedule at all (e.g. Senior Project): tickable and credit-counting, but
  // there is nothing to pick — no option groups, no "still to decide", no timetable entry.
  const noSchedule = course.noFixedSchedule === true;
  // The instructor pills are a VIEW filter only — picks no longer lock an instructor
  // group, so lecture/lab/tutorial may each be chosen from any instructor.
  const groupIdx = pinnedInstructorIdx;
  const instructor = groupIdx != null ? course.instructors[groupIdx] : null;
  const pickedCount = taking ? KIND_ORDER.filter((k) => pick[k]).length : 0;
  const [expandedKinds, setExpandedKinds] = useState<Set<MeetingType>>(new Set());

  const ctx = { pinnedInstructorIdx, preferences };
  const kindStates: Partial<Record<MeetingType, OptionState[]>> = {};
  if (taking && !noSchedule) {
    KIND_ORDER.forEach((kind) => {
      kindStates[kind] = optionStates(course, kind, takenCourses, picks, ctx);
    });
  }
  const cardSummary = mergeHiddenSummaries(Object.values(kindStates).map((s) => summarizeHidden(s ?? [])));

  /** Choosing an option affects only that component — other kinds keep their picks,
      whatever instructor they belong to. Conflicts (and only conflicts) disable rows. */
  const choose = (kind: MeetingType, key: string, _optionInstructor: number) => {
    const base: Pick = { ...emptyPick() };
    if (pick) {
      base.Lecture = pick.Lecture;
      base.Lab = pick.Lab;
      base.Tutorial = pick.Tutorial;
    }
    base[kind] = base[kind] === key ? null : key;
    onChange(base);
  };

  const toggleExpanded = (kind: MeetingType) => {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  /**
   * Clicking an instructor pill restricts this course's lists to that instructor —
   * purely what is SHOWN, never what is allowed. Any section of any instructor can be
   * picked regardless of the pill; clearing the pill restores the full lists instantly.
   */
  const pillActive = groupIdx;

  return (
    <article
      id={`course-card-${course.id}`}
      key={shakeNonce != null ? `shake-${shakeNonce}` : undefined}
      className={`course-card p-3.5 ${shakeNonce != null ? 'shake' : ''}`}
      data-state={!taking ? 'idle' : instructor ? 'selected' : 'pending'}
      onMouseEnter={() => onHoverCourse?.(course.id)}
      onMouseLeave={() => onHoverCourse?.(null)}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
      }}
      onFocusCapture={() => onHoverCourse?.(course.id)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onHoverCourse?.(null);
      }}
    >
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <input
          type="checkbox"
          id={`take-${course.id}`}
          className="tap-checkbox mt-0.5 flex-none accent-[var(--accent)]"
          checked={taking}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`Register ${course.code}`}
        />
        <label htmlFor={`take-${course.id}`} className="min-w-0 flex-1 basis-[12rem] cursor-pointer py-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: `var(--c${course.c})` }} aria-hidden />
            <span className="mono text-[13.5px] font-bold tracking-tight" style={{ color: `var(--c${course.c})` }}>
              {course.code}
            </span>
            {course.credits != null && (
              <span className="pill" title="Credit hours as published (not meeting length)">
                {course.credits} cr
              </span>
            )}
            {yearBadge && (
              <span
                className="pill"
                style={{ color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--line))' }}
                title="Added from another year of your major"
              >
                {yearBadge}
              </span>
            )}
            {taking && !noSchedule && (
              <span className="pill" style={{ color: pickedCount > 0 ? 'var(--ok)' : 'var(--muted-2)' }}>
                {pickedCount}/{countableKinds(course).length} picked
              </span>
            )}
            {taking && cardSummary.hidden > 0 && (
              <span
                className="pill"
                style={{
                  color: cardSummary.conflicts > 0 ? 'var(--warn)' : 'var(--muted)',
                  borderColor: cardSummary.conflicts > 0 ? 'var(--warn-line)' : 'var(--line)',
                }}
              >
                {cardSummary.hidden} hidden{cardSummary.conflicts > 0 ? ` • ${cardSummary.conflicts} conflict${cardSummary.conflicts > 1 ? 's' : ''}` : ''}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] leading-snug sm:text-[12px]" style={{ color: 'var(--muted)' }}>
            {course.name}
          </p>
        </label>
        <div className="ml-auto flex flex-none flex-wrap items-center justify-end gap-1.5 max-[560px]:ml-0 max-[560px]:basis-full max-[560px]:justify-start max-[560px]:pl-[30px]">
          <button
            type="button"
            className="btn btn-tap px-2.5 py-1.5 text-[11px]"
            onClick={onReportIssue}
            title="Report incorrect course data to Planora's private admin inbox"
          >
            ⚑ Report
          </button>
          {taking && (
            <>
              <button
                type="button"
                className="btn btn-tap px-2.5 py-1.5 text-[11px]"
                onClick={onToggleCourseLock}
                aria-pressed={fullyLocked}
                title={fullyLocked ? 'Unlock this course for AI and Best Schedule' : 'Keep this course unchanged by AI and Best Schedule'}
                style={fullyLocked ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}
              >
                <Icon name={fullyLocked ? 'lock' : 'unlock'} size="xs" /> {fullyLocked ? 'Locked' : 'Lock'}
              </button>
              <button
                type="button"
                className="btn btn-tap px-2.5 py-1.5 text-[11px]"
                onClick={onClearOne}
                title="Clear this course's time choices"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </header>

      {taking && noSchedule && (
        <p
          className="mt-3 rounded-lg px-2.5 py-2 text-[11.5px] leading-relaxed"
          style={{ background: 'var(--surface)', color: 'var(--muted)' }}
        >
          {course.awaitingSource ? 'Course details, credits and sections are awaiting verified Self-Service data. This selection has no timetable entry; the shown credit total excludes its unknown credits.' : <>No fixed schedule — arranged individually. Its {course.credits ?? 0} credit{(course.credits ?? 0) === 1 ? '' : 's'} still count toward your limit; nothing appears on the timetable.</>}
        </p>
      )}

      {taking && !noSchedule && (
        <>
          {course.instructors.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label={`Filter sections of ${course.code} by instructor`}>
              <span className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--muted-2)' }}>
                Instructor
              </span>
              <FilterPill
                label="All"
                active={pillActive == null}
                onClick={() => onInstructorFilter(null)}
              />
              {course.instructors.map((instr, idx) => (
                <FilterPill
                  key={instr.name + idx}
                  label={instr.unassigned ? 'Unassigned' : instr.name.split(' ')[0] + ' ' + (instr.name.split(' ')[1] ?? '')}
                  active={pillActive === idx}
                  onClick={() => onInstructorFilter(idx)}
                />
              ))}
            </div>
          )}

          {instructor && (
            <p
              className="mt-3 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold"
              style={{ background: 'var(--surface)', color: 'var(--muted)' }}
            >
              Filtering by:{' '}
              <span style={{ color: instructor.unassigned ? 'var(--warn)' : `var(--c${course.c})` }}>
                {instructor.name}
              </span>
              {instructor.unassigned && ' — no name published in self-service'}
              {' '}· only what is listed is filtered — picks from other instructors stay valid
              {' '}·{' '}
              <button type="button" className="underline decoration-dotted underline-offset-2" onClick={() => onInstructorFilter(null)}>
                show all instructors
              </button>
            </p>
          )}

          <div className="mt-3 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}>
            {KIND_ORDER.map((kind) => (
              <KindPanel
                key={kind}
                kind={kind}
                states={kindStates[kind] ?? []}
                course={course}
                instructor={instructor}
                expanded={expandedKinds.has(kind)}
                onToggleExpanded={() => toggleExpanded(kind)}
                onChoose={choose}
                locks={locks}
                onToggleComponentLock={onToggleComponentLock}
              />
            ))}
          </div>

          {instructor?.note && (
            <p className="mt-2.5 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed" style={{ background: 'var(--surface)', color: 'var(--muted)' }}>
              {instructor.note}
            </p>
          )}
        </>
      )}
    </article>
  );
}
