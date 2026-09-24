import type { Course, Instructor, Meeting, MeetingType } from '../types';
import { DAY_LABEL, overlaps, to12h } from './time';
import type { SchedulePreferences } from './preferences';

/** One manual choice per component kind, keyed by meeting uid. */
export interface Pick {
  Lecture: string | null;
  Lab: string | null;
  Tutorial: string | null;
}

export type PickState = Record<string, Pick>;

export const emptyPick = (): Pick => ({ Lecture: null, Lab: null, Tutorial: null });

/** Stable identity for a meeting option (a meeting is unique by all of its attributes). */
export const uid = (m: Meeting): string => `${m.type}|${m.sec}|${m.day}|${m.start}|${m.end}|${m.room}`;

export interface Option {
  key: string;
  meeting: Meeting;
  instructorIdx: number;
  instructor: Instructor;
}

/**
 * Every published option for this kind, across ALL instructor groups. The lecture/lab
 * choice is per-component — students may mix instructors — so the list is the union of
 * every group's sections. If two groups publish the identical section (same uid = same
 * class), it appears once, owned by the first group that lists it.
 */
export function optionsFor(course: Course, kind: MeetingType): Option[] {
  const out: Option[] = [];
  const seen = new Set<string>();
  course.instructors.forEach((instructor, instructorIdx) => {
    const pool = kind === 'Lecture' ? instructor.lectures : kind === 'Lab' ? instructor.labs : instructor.tutorials;
    pool.forEach((meeting) => {
      const key = uid(meeting);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ key, meeting, instructorIdx, instructor });
    });
  });
  return out;
}

/** Which component kinds this course publishes at all (across any instructor). */
export function publishedKinds(course: Course): MeetingType[] {
  const kinds: MeetingType[] = [];
  (['Lecture', 'Lab', 'Tutorial'] as MeetingType[]).forEach((kind) => {
    if (optionsFor(course, kind).length > 0) kinds.push(kind);
  });
  return kinds;
}

/** Resolve a picked uid back to its meeting, searching the whole course. */
export function findPicked(course: Course, key: string | null | undefined): Option | null {
  if (!key) return null;
  for (const kind of ['Lecture', 'Lab', 'Tutorial'] as MeetingType[]) {
    const hit = optionsFor(course, kind).find((o) => o.key === key);
    if (hit) return hit;
  }
  return null;
}

/** Resolve a concrete meeting back to the exact published option/instructor that owns it. */
export function meetingOption(course: Course, meeting: Meeting): Option | null {
  return optionsFor(course, meeting.type).find((o) => o.key === uid(meeting)) ?? null;
}

export interface DraftMeeting {
  courseId: string;
  course: Course;
  option: Option;
  meeting: Meeting;
}

export function draftMeetings(courses: Course[], picks: PickState): DraftMeeting[] {
  const out: DraftMeeting[] = [];
  courses.forEach((course) => {
    const pick = picks[course.id];
    if (!pick) return;
    (['Lecture', 'Lab', 'Tutorial'] as MeetingType[]).forEach((kind) => {
      const option = findPicked(course, pick[kind]);
      if (option) out.push({ courseId: course.id, course, option, meeting: option.meeting });
    });
  });
  return out;
}

export interface OverlapWarning {
  a: DraftMeeting;
  b: DraftMeeting;
  minutes: number;
}

/** Real interval overlaps between manually chosen meetings (same rule as the engine). */
export function draftOverlaps(meetings: DraftMeeting[]): OverlapWarning[] {
  const out: OverlapWarning[] = [];
  for (let i = 0; i < meetings.length; i++) {
    for (let j = i + 1; j < meetings.length; j++) {
      const a = meetings[i].meeting;
      const b = meetings[j].meeting;
      if (overlaps(a, b)) {
        out.push({
          a: meetings[i],
          b: meetings[j],
          minutes: Math.min(a.end, b.end) - Math.max(a.start, b.start),
        });
      }
    }
  }
  return out;
}

export interface PickIssue {
  courseId: string;
  code: string;
  kind: 'missing' | 'overlap' | 'selfOverlap' | 'incomplete';
  text: string;
}

/** Human-readable issues with the current manual selection. */
export function pickIssues(courses: Course[], picks: PickState, requireComplete: boolean): PickIssue[] {
  const issues: PickIssue[] = [];
  const meetings = draftMeetings(courses, picks);

  courses.forEach((course) => {
    const pick = picks[course.id];
    if (!pick) return;

    // Courses with no published schedule at all (e.g. Senior Project) have nothing to
    // decide — they are never "still to decide" and never a scheduling constraint.
    if (course.noFixedSchedule || publishedKinds(course).length === 0) return;

    // Every component the COURSE publishes must be chosen — but each one may come from
    // a different instructor; components are matched only by time, never by teacher.
    const published = publishedKinds(course);
    published.forEach((kind) => {
      if (!pick[kind]) {
        issues.push({
          courseId: course.id,
          code: course.code,
          kind: 'missing',
          text: `Pick a ${kind.toLowerCase()} time for ${course.code}.`,
        });
      }
    });

    if (requireComplete) {
      const missing = published.filter((kind) => !pick[kind]);
      if (missing.length > 0 && missing.length < published.length) {
        issues.push({
          courseId: course.id,
          code: course.code,
          kind: 'incomplete',
          text: `${course.code}: pick all published components (${missing.map((k) => k.toLowerCase()).join(' + ')} still missing), or untick the course.`,
        });
      }
    }
  });

  // Same-course overlaps (e.g. a lecture colliding with its own lab).
  for (let i = 0; i < meetings.length; i++) {
    for (let j = i + 1; j < meetings.length; j++) {
      const A = meetings[i];
      const B = meetings[j];
      if (A.courseId !== B.courseId) continue;
      if (overlaps(A.meeting, B.meeting)) {
        issues.push({
          courseId: A.courseId,
          code: A.course.code,
          kind: 'selfOverlap',
          text: `${A.course.code}: its ${A.meeting.type.toLowerCase()} and ${B.meeting.type.toLowerCase()} overlap — change one of them.`,
        });
      }
    }
  }

  return issues;
}

/* ------------------------------------------------------------------ */
/* Preference-aware reasons (soft notes vs hard blocks)                */
/* ------------------------------------------------------------------ */

/**
 * Why does a preference make this option problematic?
 * - HARD violations (a requirement the student explicitly enforced) → option is disabled
 *   with an exact reason, mirroring what the generator would reject.
 * - SOFT preference mismatches → never hide or disable anything; the option only carries
 *   an informational note ("allowed, but ranks lower"). Preferences influence ranking,
 *   they don't invalidate a manual pick.
 */
export function preferenceIssues(
  m: Meeting,
  prefs: SchedulePreferences | undefined,
): { hard: string[]; soft: string[] } {
  const hard: string[] = [];
  const soft: string[] = [];
  if (!prefs) return { hard, soft };

  if (prefs.keepFreeDays.includes(m.day)) {
    const label = DAY_LABEL[m.day];
    if (prefs.keepFreeDaysHard) hard.push(`You require ${label} to stay completely free`);
    else soft.push(`Held on ${label}, which you prefer to keep free`);
  }

  if (prefs.preferredDays.length > 0 && !prefs.preferredDays.includes(m.day)) {
    if (prefs.preferredDaysHard) hard.push(`Outside your required campus days (${prefs.preferredDays.join(', ')})`);
    else soft.push('Outside your preferred campus days');
  }

  if (prefs.noBefore != null && m.start < prefs.noBefore) {
    const t = to12h(prefs.noBefore);
    if (prefs.noBeforeStrict) hard.push(`Starts before ${t} (required limit)`);
    else soft.push(`Starts before ${t}, earlier than you prefer`);
  }

  if (prefs.noAfter != null && m.end > prefs.noAfter) {
    const t = to12h(prefs.noAfter);
    if (prefs.noAfterStrict) hard.push(`Ends after ${t} (required limit)`);
    else soft.push(`Ends after ${t}, later than you prefer`);
  }

  if ((prefs.preferredStart != null || prefs.preferredEnd != null) && prefs.timeRangeHard) {
    const s = prefs.preferredStart != null && m.start < prefs.preferredStart;
    const e = prefs.preferredEnd != null && m.end > prefs.preferredEnd;
    if (s || e) {
      const window = `${prefs.preferredStart != null ? to12h(prefs.preferredStart) : '8:00 AM'}–${
        prefs.preferredEnd != null ? to12h(prefs.preferredEnd) : '6:00 PM'
      }`;
      hard.push(`Falls outside your required ${window} window`);
    }
  }

  return { hard, soft };
}

/* ------------------------------------------------------------------ */
/* Smart dynamic filtering — derived, reversible visibility/conflict   */
/* state for every option. Nothing here mutates COURSES or PickState;  */
/* it is recomputed fresh from the current picks on every call.        */
/* ------------------------------------------------------------------ */

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
