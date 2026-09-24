import { useState } from 'react';
import type { Course, MeetingType } from '../types';
import { DAY_LABEL, formatRange } from '../lib/time';
import {
  emptyPick,
  hiddenReasons,
  isOptionDisabled,
  mergeHiddenSummaries,
  optionStates,
  summarizeHidden,
  type OptionState,
  type Pick,
  type PickState,
} from '../lib/picks';
import type { SchedulePreferences } from '../lib/preferences';
import { isComponentLocked, isCourseLocked, type PlannerLocks } from '../lib/assistantControls';

interface Props {
  courses: Course[];
  picks: PickState;
  /** Active instructor filter per course (the pills below). */
  instructorFilter: Record<string, number>;
  onInstructorFilter: (courseId: string, idx: number | null) => void;
  preferences?: SchedulePreferences;
  onChange: (courseId: string, pick: Pick) => void;
  onToggle: (courseId: string, taking: boolean) => void;
  onClearOne: (courseId: string) => void;
  /** "Year X" badge per course id, for courses added from another year of the major. */
  yearBadges?: Record<string, string>;
  /** Opens the cross-year course browser ("Choose from another year"). */
  onOpenCrossYear?: () => void;
  /** Credit-cap rejection message shown inline near the course list, if any. */
  capNotice?: string | null;
  /** Course whose card should shake after a rejected (over-cap) addition. */
  shake?: { courseId: string; nonce: number } | null;
  /** Desktop hover/focus bridge to the timetable. */
  onHoverCourse?: (courseId: string | null) => void;
  locks: PlannerLocks;
  onToggleCourseLock: (courseId: string) => void;
  onToggleComponentLock: (courseId: string, kind: MeetingType) => void;
  onReportIssue: (courseId: string) => void;
}

const KIND_ORDER: MeetingType[] = ['Lecture', 'Lab', 'Tutorial'];
const KIND_ICON: Record<MeetingType, string> = { Lecture: '📢', Lab: '🧪', Tutorial: '📝' };

export function CoursePicker({
  courses,
  picks,
  instructorFilter,
  onInstructorFilter,
  preferences,
  onChange,
  onToggle,
  onClearOne,
  yearBadges,
  onOpenCrossYear,
  capNotice,
  shake,
  onHoverCourse,
  locks,
  onToggleCourseLock,
  onToggleComponentLock,
  onReportIssue,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [schOpen, setSchOpen] = useState(true);
  const takenCourses = courses.filter((c) => picks[c.id]);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleCourses = normalizedSearch
    ? courses.filter(
        (c) =>
          c.code.toLowerCase().includes(normalizedSearch) ||
          c.name.toLowerCase().includes(normalizedSearch),
      )
    : courses;

  const currentYearCourses = visibleCourses.filter(
    (c) => !c.code.startsWith('SCH ') && !yearBadges?.[c.id],
  );
  const schCourses = visibleCourses.filter((c) => c.code.startsWith('SCH '));
  const otherYearCourses = visibleCourses.filter(
    (c) => !c.code.startsWith('SCH ') && !!yearBadges?.[c.id],
  );
  const selectedSchCount = schCourses.filter((c) => !!picks[c.id]).length;

  const renderCourse = (course: Course) => (
    <CourseCard
      key={course.id}
      course={course}
      pick={picks[course.id]}
      takenCourses={takenCourses}
      picks={picks}
      pinnedInstructorIdx={instructorFilter[course.id] ?? null}
      onInstructorFilter={(idx) => onInstructorFilter(course.id, idx)}
      preferences={preferences}
      onChange={(next) => onChange(course.id, next)}
      onToggle={(taking) => onToggle(course.id, taking)}
      onClearOne={() => onClearOne(course.id)}
      yearBadge={yearBadges?.[course.id]}
      shakeNonce={shake?.courseId === course.id ? shake.nonce : null}
      onHoverCourse={onHoverCourse}
      locks={locks}
      onToggleCourseLock={() => onToggleCourseLock(course.id)}
      onToggleComponentLock={(kind) => onToggleComponentLock(course.id, kind)}
      onReportIssue={() => onReportIssue(course.id)}
    />
  );

  const overallSummary = mergeHiddenSummaries(
    takenCourses.flatMap((course) =>
      KIND_ORDER.map((kind) =>
        summarizeHidden(
          optionStates(course, kind, takenCourses, picks, {
            pinnedInstructorIdx: instructorFilter[course.id] ?? null,
            preferences,
          }),
        ),
      ),
    ),
  );

  return (
    <section className="panel no-print p-4 sm:p-5" aria-labelledby="picker-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="picker-heading" className="text-[13px] font-bold tracking-tight">
            Courses this term
          </h2>
          <p className="mt-1 max-w-[42ch] text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            Tick a course, then pick a time for each component it publishes — lecture and lab/tutorial may belong to
            different instructors; only real time clashes are rejected. Options that clash with a pick are disabled
            automatically — untick or change that pick and they come right back.
          </p>
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          {overallSummary.hidden > 0 && (
            <span
              className="pill flex-none"
              style={{
                color: overallSummary.conflicts > 0 ? 'var(--warn)' : 'var(--muted)',
                borderColor: overallSummary.conflicts > 0 ? 'var(--warn-line)' : 'var(--line)',
                background: overallSummary.conflicts > 0 ? 'var(--warn-bg)' : 'var(--surface)',
              }}
            >
              {overallSummary.hidden} hidden
              {overallSummary.conflicts > 0 ? ` • ${overallSummary.conflicts} conflict${overallSummary.conflicts > 1 ? 's' : ''}` : ''}
            </span>
          )}
          {onOpenCrossYear && (
            <button
              type="button"
              className="btn btn-tap px-2.5 py-1.5 text-[11px]"
              onClick={onOpenCrossYear}
              title="Browse and add courses from any other year of your major"
            >
              🗂 Choose from another year
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label className="sr-only" htmlFor="course-search">Search courses</label>
        <div className="course-search-wrap">
          <span aria-hidden>⌕</span>
          <input
            id="course-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by course code or name..."
            className="course-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="course-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear course search"
            >
              ×
            </button>
          )}
        </div>
        {normalizedSearch && (
          <p className="mt-1.5 text-[10.5px]" style={{ color: 'var(--muted-2)' }}>
            {visibleCourses.length} matching course{visibleCourses.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {capNotice && (
        <p
          className="mt-3 rounded-xl border px-3.5 py-2.5 text-[12px] font-semibold"
          style={{ borderColor: 'var(--warn-line)', background: 'var(--warn-bg)', color: 'var(--warn)' }}
          role="alert"
          aria-live="assertive"
        >
          {capNotice}
        </p>
      )}

      <div className="mt-4 space-y-4">
        {currentYearCourses.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-1">
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-2)' }}>
                  Current year courses
                </h3>
                <p className="text-[10.5px]" style={{ color: 'var(--muted-2)' }}>
                  {currentYearCourses.length} course{currentYearCourses.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            {currentYearCourses.map(renderCourse)}
          </section>
        )}

        {schCourses.length > 0 && (
          <section className="space-y-2.5">
            <button
              type="button"
              className="course-group-toggle"
              onClick={() => setSchOpen((v) => !v)}
              aria-expanded={normalizedSearch ? true : schOpen}
            >
              <span className="min-w-0 text-left">
                <span className="block text-[11px] font-bold uppercase tracking-[0.08em]">SCH electives</span>
                <span className="block text-[10.5px] font-medium" style={{ color: 'var(--muted-2)' }}>
                  {schCourses.length} available{selectedSchCount > 0 ? ` · ${selectedSchCount} selected` : ''}
                </span>
              </span>
              <span className="pill">{normalizedSearch || schOpen ? 'Hide' : 'Show'}</span>
            </button>
            {(normalizedSearch || schOpen) && schCourses.map(renderCourse)}
          </section>
        )}

        {otherYearCourses.length > 0 && (
          <section className="space-y-2.5">
            <div className="px-1">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-2)' }}>
                Added from other years
              </h3>
            </div>
            {otherYearCourses.map(renderCourse)}
          </section>
        )}

        {visibleCourses.length === 0 && (
          <div className="panel-soft p-5 text-center">
            <p className="text-[12.5px] font-semibold">No courses match “{searchQuery}”.</p>
            <button type="button" className="btn btn-tap mt-3" onClick={() => setSearchQuery('')}>
              Clear search
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function CourseCard({
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
  const courseLocked = isCourseLocked(locks, course.id);
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
      <header className="flex items-start gap-3">
        <input
          type="checkbox"
          id={`take-${course.id}`}
          className="tap-checkbox mt-0.5 flex-none accent-[var(--accent)]"
          checked={taking}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`Register ${course.code}`}
        />
        <label htmlFor={`take-${course.id}`} className="min-w-0 flex-1 cursor-pointer py-0.5">
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
        <div className="flex flex-none flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            className="btn btn-tap px-2.5 py-1.5 text-[11px]"
            onClick={onReportIssue}
            title="Copy a ready-to-send data issue report for this course"
          >
            ⚑ Report
          </button>
          {taking && (
            <>
              <button
                type="button"
                className="btn btn-tap px-2.5 py-1.5 text-[11px]"
                onClick={onToggleCourseLock}
                aria-pressed={courseLocked}
                title={courseLocked ? 'Unlock this course for AI and Best Schedule' : 'Keep this course unchanged by AI and Best Schedule'}
                style={courseLocked ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}
              >
                {courseLocked ? '🔒 Locked' : '🔓 Lock'}
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
          No fixed schedule — arranged individually. Its {course.credits ?? 0} credit
          {(course.credits ?? 0) === 1 ? '' : 's'} still count toward your limit; nothing appears on the timetable.
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
            {KIND_ORDER.map((kind) => {
              const states = kindStates[kind] ?? [];
              if (states.length === 0) return null;
              // Selected items must remain visible whatever the filters say; everything that is
              // hidden or blocked moves into the expandable "Why is this hidden?" group.
              const visible = states.filter((s) => !s.hiddenByInstructor && !s.disabledByConflict && s.hardReasons.length === 0);
              const unavailable = states.filter((s) => s.hiddenByInstructor || s.disabledByConflict || s.hardReasons.length > 0);
              const summary = summarizeHidden(states);
              const expanded = expandedKinds.has(kind);
              return (
                <div key={kind} className="panel-soft p-2.5">
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
                          onSelect={() => choose(kind, option.key, option.instructorIdx)}
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
                            onSelect={() => choose(kind, option.key, option.instructorIdx)}
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
                        onClick={() => toggleExpanded(kind)}
                        aria-expanded={expanded}
                      >
                        {expanded ? '▾ Hide' : `▸ Why is this hidden? (${unavailable.length})`}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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

function FilterPill({ label, active, locked, onClick }: { label: string; active: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={locked ? 'Different instructor is fixed by your current picks — pick a section from this group to switch' : undefined}
      className="btn-tap rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
      style={{
        border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
        background: active ? 'color-mix(in srgb, var(--accent) 14%, var(--paper))' : 'var(--surface)',
        color: active ? 'var(--accent)' : locked ? 'var(--muted-2)' : 'var(--muted)',
        opacity: locked && !active ? 0.65 : 1,
        maxWidth: 170,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function OptionRow({
  option,
  course,
  groupLabel,
  onSelect,
  showReasons,
  locked,
  onToggleLock,
}: {
  option: OptionState;
  course: Course;
  groupLabel?: string;
  onSelect: () => void;
  showReasons?: boolean;
  locked?: boolean;
  onToggleLock?: () => void;
}) {
  const active = option.picked;
  const disabled = isOptionDisabled(option);
  const reasons = hiddenReasons(option, groupLabel);
  const kind = option.meeting.type;

  return (
    <div
      title={reasons.length ? `Hidden because:\n${reasons.map((r) => `• ${r}`).join('\n')}` : undefined}
      className="tap-row flex items-start gap-2 rounded-lg px-2 py-2 text-[12px] font-semibold transition-colors sm:text-[11.5px]"
      style={{
        background: active ? `var(--c${course.c}-bg)` : 'transparent',
        border: `1px solid ${active ? `var(--c${course.c})` : disabled || option.hiddenByInstructor ? 'var(--warn-line)' : 'transparent'}`,
        color: active ? `var(--c${course.c})` : disabled ? 'var(--muted-2)' : 'var(--ink)',
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2" style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <input
          type="radio"
          name={`${course.id}-${kind}`}
          className="tap-radio mt-0.5 accent-[var(--accent)]"
          checked={active}
          disabled={disabled}
          onChange={() => !disabled && onSelect()}
        />
        <span className="min-w-0 flex-1">
          <span className="mono block" style={{ textDecoration: disabled ? 'line-through' : 'none' }}>
            {DAY_LABEL[option.meeting.day].slice(0, 3)} · {formatRange(option.meeting.start, option.meeting.end)}
          </span>
          <span className="block text-[11px] font-medium sm:text-[10.5px]" style={{ color: reasons.length && !option.picked ? 'var(--warn)' : 'var(--muted)' }}>
            Sec {option.meeting.sec} · {option.meeting.room} · {option.instructor.name}
          </span>
          {showReasons && reasons.length > 0 && (
            <span className="mt-1 block space-y-0.5">
              {reasons.map((reason) => (
                <span key={reason} className="block text-[10px] font-medium leading-snug" style={{ color: 'var(--warn)' }}>
                  {reason}
                </span>
              ))}
            </span>
          )}
        </span>
      </label>
      {active && onToggleLock && (
        <button
          type="button"
          className="btn-tap flex-none rounded-lg px-2 py-1 text-[10px] font-bold"
          onClick={onToggleLock}
          aria-pressed={Boolean(locked)}
          title={locked ? 'Unlock this section for AI and Best Schedule' : 'Keep this section unchanged by AI and Best Schedule'}
          style={{
            border: `1px solid ${locked ? 'var(--accent)' : 'var(--line)'}`,
            color: locked ? 'var(--accent)' : 'var(--muted)',
            background: 'var(--surface)',
          }}
        >
          {locked ? '🔒' : '🔓'}
        </button>
      )}
    </div>
  );
}

function countableKinds(course: Course): MeetingType[] {
  return KIND_ORDER.filter(
    (kind) => (kind === 'Lecture' ? course.instructors.some((i) => i.lectures.length) : kind === 'Lab' ? course.instructors.some((i) => i.labs.length) : course.instructors.some((i) => i.tutorials.length)),
  );
}
