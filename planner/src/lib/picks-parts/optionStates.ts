import { draftMeetings, optionsFor } from '../picks';
import type { Option, PickState } from '../picks';
import { preferenceIssues } from './issues';
import type { Course, MeetingType } from '../../types';
import { overlaps } from '../time';
import type { SchedulePreferences } from '../preferences';

export interface OptionState extends Option {
  /** This exact option is the one currently chosen for this course/kind. */
  picked: boolean;
  /** Hidden by the course's instructor FILTER pill (view state only — clearing the pill brings it back). */
  hiddenByInstructor: boolean;
  /** Still listed, but disabled because it overlaps a meeting that is already active elsewhere. */
  disabledByConflict: boolean;
  /** What it would conflict with, for the explanatory tooltip. */
  conflicts: { courseCode: string; type: MeetingType }[];
  /** Disabled because it breaks a HARD schedule preference. */
  hardReasons: string[];
  /** Informational notes from SOFT preferences — never hides anything. */
  softNotes: string[];
}

export interface OptionStatesContext {
  pinnedInstructorIdx?: number | null;
  preferences?: SchedulePreferences;
}

/**
 * Status of every published option for one course/kind, given everything the user
 * has picked so far (this course's other components, and every other taken course),
 * the active instructor filter, and the schedule preferences.
 * Purely derived — recomputing it after any change is what makes the filtering
 * reversible: remove the conflicting pick (or relax the filter) and the option comes
 * right back. The original dataset is never mutated.
 */
export function optionStates(
  course: Course,
  kind: MeetingType,
  takenCourses: Course[],
  picks: PickState,
  ctx: OptionStatesContext = {},
): OptionState[] {
  const pick = picks[course.id];
  // Cross-instructor components are allowed: picks never lock the list. The only
  // hiding here is the user's own explicit instructor FILTER (the pill), which is
  // pure view state — clearing the pill brings every option straight back.
  const groupIdx = ctx.pinnedInstructorIdx ?? null;
  const activeElsewhere = draftMeetings(takenCourses, picks).filter(
    (m) => !(m.courseId === course.id && m.meeting.type === kind),
  );

  return optionsFor(course, kind).map((option) => {
    const picked = pick?.[kind] === option.key;
    const hiddenByInstructor = !picked && groupIdx != null && groupIdx !== option.instructorIdx;
    // Computed regardless of hiddenByInstructor so "Why is this hidden?" can list every
    // reason that actually applies (an option can be both a different instructor group
    // AND time-conflicting at once).
    const conflicts = picked
      ? []
      : activeElsewhere
          .filter((m) => overlaps(m.meeting, option.meeting))
          .map((m) => ({ courseCode: m.course.code, type: m.meeting.type }));
    const disabledByConflict = !picked && !hiddenByInstructor && conflicts.length > 0;
    const pref = picked ? { hard: [], soft: [] } : preferenceIssues(option.meeting, ctx.preferences);
    return {
      ...option,
      picked,
      hiddenByInstructor,
      disabledByConflict,
      conflicts,
      hardReasons: pref.hard,
      softNotes: pref.soft,
    };
  });
}

export interface HiddenSummary {
  /** Total options currently unavailable (other instructor group + time conflicts + hard limits). */
  hidden: number;
  /** Subset of `hidden` that is specifically due to a time conflict. */
  conflicts: number;
}

export function summarizeHidden(states: OptionState[]): HiddenSummary {
  let hidden = 0;
  let conflicts = 0;
  states.forEach((s) => {
    if (s.hiddenByInstructor) hidden++;
    else if (s.disabledByConflict) {
      hidden++;
      conflicts++;
    } else if (s.hardReasons.length > 0) hidden++;
  });
  return { hidden, conflicts };
}

export function mergeHiddenSummaries(list: HiddenSummary[]): HiddenSummary {
  return list.reduce(
    (acc, s) => ({ hidden: acc.hidden + s.hidden, conflicts: acc.conflicts + s.conflicts }),
    { hidden: 0, conflicts: 0 },
  );
}

/**
 * Every reason this specific option is currently hidden/disabled — only the reasons that
 * actually apply to it, never a generic catch-all. Used by the "Why is this hidden?" control.
 */
export function hiddenReasons(state: OptionState, groupLabel?: string): string[] {
  const reasons: string[] = [];
  if (state.hiddenByInstructor) {
    reasons.push(
      groupLabel
        ? `Hidden by the "${groupLabel}" instructor filter — this section belongs to another instructor`
        : 'Hidden by the active instructor filter — clear the filter pill to see it again',
    );
  }
  if (state.conflicts.length > 0) {
    const unique = Array.from(new Set(state.conflicts.map((c) => `${c.courseCode} ${c.type.toLowerCase()}`)));
    unique.forEach((u) => reasons.push(`Conflicts with ${u}`));
  }
  state.hardReasons.forEach((r) => reasons.push(r));
  return reasons;
}

/** True when the option is visible but not selectable (conflict or hard preference). */
export function isOptionDisabled(state: OptionState): boolean {
  return state.disabledByConflict || state.hardReasons.length > 0;
}
