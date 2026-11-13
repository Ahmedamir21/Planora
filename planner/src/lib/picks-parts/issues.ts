import { draftMeetings, publishedKinds } from '../picks';
import type { PickState } from '../picks';
import type { Course, Meeting } from '../../types';
import { DAY_LABEL, overlaps, to12h } from '../time';
import type { SchedulePreferences } from '../preferences';

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
