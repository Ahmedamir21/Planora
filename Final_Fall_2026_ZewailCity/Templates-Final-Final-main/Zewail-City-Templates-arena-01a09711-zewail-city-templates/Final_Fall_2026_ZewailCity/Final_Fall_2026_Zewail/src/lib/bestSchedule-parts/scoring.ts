import { DaySpan } from './types';
import type { ComboMetrics, Course, Day, Instructor, Meeting, Pairing } from '../../types';
import { buildCoursePairings } from '../scheduler-parts/pairings';
import { DAYS, formatRange, sortMeetings } from '../time';
import type { SchedulePreferences } from '../preferences';
import type { PickState } from '../picks';
import { lockedPickForCourse, pairingMatchesLockedPick, type PlannerLocks } from '../assistantControls';

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Per-meeting hard limits. Everything else is soft and handled by ranking only. */
export function withinHardRange(meeting: Meeting, prefs: SchedulePreferences): boolean {
  if (prefs.noBeforeStrict && prefs.noBefore != null && meeting.start < prefs.noBefore) return false;
  if (prefs.noAfterStrict && prefs.noAfter != null && meeting.end > prefs.noAfter) return false;
  // An enforced "preferred time range" must hold for every meeting of the schedule.
  if (prefs.timeRangeHard) {
    if (prefs.preferredStart != null && meeting.start < prefs.preferredStart) return false;
    if (prefs.preferredEnd != null && meeting.end > prefs.preferredEnd) return false;
  }
  return true;
}

export function pairingDayMinutes(pairing: Pairing): Map<Day, number> {
  const map = new Map<Day, number>();
  pairing.meetings.forEach((m) => map.set(m.day, (map.get(m.day) ?? 0) + (m.end - m.start)));
  return map;
}

/**
 * Build every valid lecture+lab/tutorial pairing across every instructor of a course,
 * applying HARD constraints as early exclusions. This is the single biggest pruning win:
 * a course whose pairings all violate a hard constraint removes that whole subtree before
 * any cross-course search happens, and it is reported explicitly rather than silently.
 *
 * Never invents a pairing — only combinations the published section data actually allows.
 */
export function buildCandidates(course: Course, prefs: SchedulePreferences, picks?: PickState, locks?: PlannerLocks) {
  const list: { instructorIdx: number; instructor: Instructor; pairing: Pairing }[] = [];

  const restrictDays = prefs.preferredDaysHard && prefs.preferredDays.length > 0;
  const forbidDays = prefs.keepFreeDaysHard && prefs.keepFreeDays.length > 0;
  const limitMin = prefs.maxHoursHard && prefs.maxHoursPerDay != null ? prefs.maxHoursPerDay * 60 : null;

  const locked = picks && locks ? lockedPickForCourse(picks, locks, course.id) : {};

  // Cross-instructor pairing: the only exclusions here are genuine time conflicts,
  // hard preference rules, and explicit student locks.
  buildCoursePairings(course).forEach((pairing) => {
    if (!pairingMatchesLockedPick(pairing, locked)) return;
    if (!pairing.meetings.every((m) => withinHardRange(m, prefs))) return;
    if (restrictDays && pairing.meetings.some((m) => !prefs.preferredDays.includes(m.day))) return;
    if (forbidDays && pairing.meetings.some((m) => prefs.keepFreeDays.includes(m.day))) return;
    if (limitMin != null) {
      const perDay = pairingDayMinutes(pairing);
      const over = [...perDay.values()].some((mins) => mins > limitMin);
      if (over) return;
    }
    // "Primary" instructor for display/sharing = whoever teaches the lecture, falling
    // back to the first component's teacher (lab-only or tutorial-only courses).
    const primaryIdx =
      pairing.instructors?.Lecture ??
      pairing.instructors?.Lab ??
      pairing.instructors?.Tutorial ??
      0;
    list.push({ instructorIdx: primaryIdx, instructor: course.instructors[primaryIdx], pairing });
  });
  return list;
}

export function minutesByDay(meetings: Meeting[]): Map<Day, number> {
  const map = new Map<Day, number>();
  meetings.forEach((m) => map.set(m.day, (map.get(m.day) ?? 0) + (m.end - m.start)));
  return map;
}

/** Exact class minutes on one day: each meeting contributes its real (end − start). */
export function dayMinutesTotal(meetings: Meeting[], day: Day): number {
  let total = 0;
  meetings.forEach((m) => {
    if (m.day === day) total += m.end - m.start;
  });
  return total;
}

export function buildDaySpans(meetings: Meeting[]): DaySpan[] {
  return DAYS.map((day) => {
    const list = meetings.filter((m) => m.day === day);
    if (list.length === 0) return { day, free: true, label: 'Free' };
    const sorted = sortMeetings(list);
    const start = sorted[0].start;
    const end = Math.max(...sorted.map((m) => m.end));
    return { day, free: false, label: formatRange(start, end) };
  });
}

/**
 * Explicit, disclosed weighting — not a claim of one objectively "best" schedule.
 * Each factor is normalized to 0..1. Weight rises when the student actually asked for that
 * factor; unselected factors keep a small base weight so they still act as tie-breakers.
 */
export function scoreCandidate(meetings: Meeting[], metrics: ComboMetrics, prefs: SchedulePreferences) {
  const perDay = minutesByDay(meetings);
  const usedDays = new Set(meetings.map((m) => m.day));

  const gapScore = clamp01(1 - metrics.gapMinutes / 240);
  const freeDaysScore = (DAYS.length - usedDays.size) / DAYS.length;
  const earliestFinishScore = metrics.latest == null ? 1 : clamp01(1 - (metrics.latest - 12 * 60) / (8 * 60));
  const latestStartScore = metrics.earliest == null ? 1 : clamp01((metrics.earliest - 8 * 60) / (6 * 60));

  let preferredDaysScore = 1;
  if (prefs.preferredDays.length > 0) {
    const inPref = [...usedDays].filter((d) => prefs.preferredDays.includes(d)).length;
    preferredDaysScore = usedDays.size === 0 ? 1 : inPref / usedDays.size;
  }

  const keepFreeViolations = prefs.keepFreeDays.filter((d) => usedDays.has(d));
  const keepFreeScore = prefs.keepFreeDays.length === 0 ? 1 : 1 - keepFreeViolations.length / prefs.keepFreeDays.length;

  let timeRangeScore = 1;
  if (prefs.preferredStart != null || prefs.preferredEnd != null) {
    const start = prefs.preferredStart ?? 0;
    const end = prefs.preferredEnd ?? 24 * 60;
    let inside = 0;
    let total = 0;
    meetings.forEach((m) => {
      total += m.end - m.start;
      inside += Math.max(0, Math.min(m.end, end) - Math.max(m.start, start));
    });
    timeRangeScore = total === 0 ? 1 : clamp01(inside / total);
  }

  let noBeforeScore = 1;
  if (prefs.noBefore != null && !prefs.noBeforeStrict && meetings.length > 0) {
    const violating = meetings.filter((m) => m.start < prefs.noBefore!).length;
    noBeforeScore = 1 - violating / meetings.length;
  }
  let noAfterScore = 1;
  if (prefs.noAfter != null && !prefs.noAfterStrict && meetings.length > 0) {
    const violating = meetings.filter((m) => m.end > prefs.noAfter!).length;
    noAfterScore = 1 - violating / meetings.length;
  }

  let maxHoursViolationDays: Day[] = [];
  let maxHoursScore = 1;
  if (prefs.maxHoursPerDay != null) {
    const limitMin = prefs.maxHoursPerDay * 60;
    maxHoursViolationDays = DAYS.filter((d) => (perDay.get(d) ?? 0) > limitMin);
    const totalDaysUsed = usedDays.size || 1;
    maxHoursScore = 1 - maxHoursViolationDays.length / totalDaysUsed;
  }

  let campusDaysScore = 1;
  if (prefs.preferredCampusDays != null) {
    // Exact match = 1.0; each day away reduces the score smoothly.
    campusDaysScore = clamp01(1 - Math.abs(usedDays.size - prefs.preferredCampusDays) / Math.max(1, DAYS.length - 1));
  }

  const w = { gap: 0.12, free: 0.12, finish: 0, start: 0, prefDays: 0, keepFree: 0, range: 0, edge: 0, maxHours: 0, campusDays: 0 };
  if (prefs.goals.minimizeGaps) w.gap += 0.22;
  if (prefs.goals.maximizeFreeDays) w.free += 0.22;
  if (prefs.goals.earliestFinish) w.finish = 0.22;
  if (prefs.goals.latestStart) w.start = 0.22;
  if (prefs.preferredDays.length > 0) w.prefDays = 0.14;
  if (prefs.keepFreeDays.length > 0) w.keepFree = 0.3;
  if (prefs.preferredStart != null || prefs.preferredEnd != null) w.range += 0.14;
  if ((prefs.noBefore != null && !prefs.noBeforeStrict) || (prefs.noAfter != null && !prefs.noAfterStrict)) w.edge += 0.1;
  if (prefs.maxHoursPerDay != null) w.maxHours = 0.22;
  if (prefs.preferredCampusDays != null) w.campusDays = 0.32;

  const totalWeight = Object.values(w).reduce((s, v) => s + v, 0) || 1;
  const weightedSum =
    w.gap * gapScore +
    w.free * freeDaysScore +
    w.finish * earliestFinishScore +
    w.start * latestStartScore +
    w.prefDays * preferredDaysScore +
    w.keepFree * keepFreeScore +
    w.range * timeRangeScore +
    w.edge * ((noBeforeScore + noAfterScore) / 2) +
    w.maxHours * maxHoursScore +
    w.campusDays * campusDaysScore;

  return {
    percent: Math.round(clamp01(weightedSum / totalWeight) * 100),
    keepFreeViolations,
    maxHoursViolationDays,
  };
}

/**
 * How many pairings this course publishes before any hard filtering. Used only to tell
 * "this course has no sections at all" apart from "hard constraints excluded its sections",
 * so the UI can show the right message.
 */
export function countAllPairings(course: Course): number {
  return buildCoursePairings(course).length;
}
