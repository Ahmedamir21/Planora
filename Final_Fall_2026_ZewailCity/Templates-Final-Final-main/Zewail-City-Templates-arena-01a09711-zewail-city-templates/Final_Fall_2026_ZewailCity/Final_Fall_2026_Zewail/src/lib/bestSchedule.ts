import type { ComboMetrics, Course, Day, Instructor, Meeting, Pairing } from '../types';
import { buildCoursePairings, measureSchedule } from './scheduler';
import { DAYS, formatRange, overlaps, sortMeetings, to12h } from './time';
import type { SchedulePreferences } from './preferences';
import type { PickState } from './picks';
import { lockedPickForCourse, pairingMatchesLockedPick, type PlannerLocks } from './assistantControls';

/**
 * Safety cap on search-tree nodes visited. This bounds worst-case work independently of
 * how many sections exist, so the UI can never hang on a pathological combination.
 */
const NODE_BUDGET = 200_000;

/**
 * How many ranked candidates are retained in memory. Generation stops retaining anything
 * that cannot beat the worst of these, so memory stays flat instead of growing with the
 * number of valid combinations.
 */
export const POOL_LIMIT = 100;

/** How many of the retained candidates are actually rendered as cards. */
export const RESULT_LIMIT = 6;

export interface ScheduleCourseEntry {
  course: Course;
  instructor: Instructor;
  instructorIdx: number;
  pairing: Pairing;
}

export interface DaySpan {
  day: Day;
  free: boolean;
  label: string;
}

export interface GeneratedSchedule {
  id: string;
  perCourse: ScheduleCourseEntry[];
  meetings: Meeting[];
  metrics: ComboMetrics;
  credits: number;
  scorePercent: number;
  keepFreeViolations: Day[];
  maxHoursViolationDays: Day[];
  daySpans: DaySpan[];
  /**
   * Longest single day in this schedule, in exact class minutes (end − start summed per day).
   * Uses real durations only — no padding — so 10:00–12:00 is exactly 2 hours.
   */
  maxDayMinutes: number;
}

export interface BestScheduleReport {
  schedules: GeneratedSchedule[];
  totalValid: number;
  /** True when the node budget was hit — the pool is then the best found so far, not exhaustive. */
  truncated: boolean;
  /** True when the search stopped early because a perfect-scoring pool was already full. */
  earlyExit: boolean;
  /**
   * Courses with NO viable candidate at all. Split into two distinct reasons because they
   * need different messages: a course may genuinely publish no sections, or it may publish
   * sections that are all excluded by the student's hard constraints. Collapsing these used
   * to produce a "required constraints" error with an empty constraint list.
   */
  noSections: { courseId: string; code: string }[];
  /** Courses that DO publish sections, but every section violates a hard constraint. */
  blockedByHard: { courseId: string; code: string }[];
  /** Human-readable list of the hard constraints currently configured. */
  unsatisfiableHard: string[];
  /** True only when hard constraints were requested AND at least one valid schedule satisfies them. */
  hardFeasible: boolean;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Per-meeting hard limits. Everything else is soft and handled by ranking only. */
function withinHardRange(meeting: Meeting, prefs: SchedulePreferences): boolean {
  if (prefs.noBeforeStrict && prefs.noBefore != null && meeting.start < prefs.noBefore) return false;
  if (prefs.noAfterStrict && prefs.noAfter != null && meeting.end > prefs.noAfter) return false;
  // An enforced "preferred time range" must hold for every meeting of the schedule.
  if (prefs.timeRangeHard) {
    if (prefs.preferredStart != null && meeting.start < prefs.preferredStart) return false;
    if (prefs.preferredEnd != null && meeting.end > prefs.preferredEnd) return false;
  }
  return true;
}

function pairingDayMinutes(pairing: Pairing): Map<Day, number> {
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
function buildCandidates(course: Course, prefs: SchedulePreferences, picks?: PickState, locks?: PlannerLocks) {
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

function minutesByDay(meetings: Meeting[]): Map<Day, number> {
  const map = new Map<Day, number>();
  meetings.forEach((m) => map.set(m.day, (map.get(m.day) ?? 0) + (m.end - m.start)));
  return map;
}

/** Exact class minutes on one day: each meeting contributes its real (end − start). */
function dayMinutesTotal(meetings: Meeting[], day: Day): number {
  let total = 0;
  meetings.forEach((m) => {
    if (m.day === day) total += m.end - m.start;
  });
  return total;
}

function buildDaySpans(meetings: Meeting[]): DaySpan[] {
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
function scoreCandidate(meetings: Meeting[], metrics: ComboMetrics, prefs: SchedulePreferences) {
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
function countAllPairings(course: Course): number {
  return buildCoursePairings(course).length;
}

/** True when at least one hard-constraint switch is currently enforced. */
export function hardConstraintsActive(prefs: SchedulePreferences): boolean {
  return hardConstraintLabels(prefs).length > 0;
}

/** Descriptions used when a hard constraint turns out to be impossible. */
function hardConstraintLabels(prefs: SchedulePreferences): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (prefs.noBeforeStrict && prefs.noBefore != null) out.push({ key: 'noBefore', label: `no classes before ${to12h(prefs.noBefore)}` });
  if (prefs.noAfterStrict && prefs.noAfter != null) out.push({ key: 'noAfter', label: `no classes after ${to12h(prefs.noAfter)}` });
  if (prefs.timeRangeHard && (prefs.preferredStart != null || prefs.preferredEnd != null)) {
    const from = prefs.preferredStart != null ? to12h(prefs.preferredStart) : '8:00 AM';
    const to = prefs.preferredEnd != null ? to12h(prefs.preferredEnd) : '6:00 PM';
    out.push({ key: 'tr', label: `every class inside ${from}–${to}` });
  }
  if (prefs.preferredDaysHard && prefs.preferredDays.length) out.push({ key: 'prefDays', label: `classes only on ${prefs.preferredDays.join(', ')}` });
  if (prefs.keepFreeDaysHard && prefs.keepFreeDays.length) out.push({ key: 'keepFree', label: `keeping ${prefs.keepFreeDays.join(', ')} completely free` });
  if (prefs.maxHoursHard && prefs.maxHoursPerDay != null) out.push({ key: 'maxHours', label: `at most ${prefs.maxHoursPerDay} hours per day` });
  if (prefs.campusDaysHard && prefs.preferredCampusDays != null) {
    out.push({ key: 'campusDays', label: `at most ${prefs.preferredCampusDays} campus days per week` });
  }
  return out;
}

/**
 * Generate the best-ranked, conflict-free schedules across EVERY instructor of every taken
 * course — which is what makes "Best Schedule" different from "Suggest Best Combination" on
 * an already-fixed instructor set.
 *
 * Scalability strategy (never random, never fabricated):
 *  1. Hard constraints are applied while building per-course candidates, collapsing whole
 *     subtrees before the cross-course search begins.
 *  2. Courses are ordered most-constrained-first, and each course's candidates are pre-sorted
 *     so good solutions appear early.
 *  3. Conflict + hard-max-hours checks run at every step, so a branch dies the moment a
 *     meeting clashes instead of after the full assignment.
 *  4. Only a bounded top-K pool is retained. A candidate whose score cannot beat the pool's
 *     worst is discarded immediately, before the expensive schedule object is built.
 *  5. A node budget caps total work; hitting it yields the best-found-so-far and is reported
 *     as truncated rather than pretending the search was exhaustive.
 */
export function generateBestSchedules(
  courses: Course[],
  prefs: SchedulePreferences,
  picks?: PickState,
  locks?: PlannerLocks,
): BestScheduleReport {
  if (courses.length === 0) {
    return {
      schedules: [],
      totalValid: 0,
      truncated: false,
      earlyExit: false,
      noSections: [],
      blockedByHard: [],
      unsatisfiableHard: [],
      hardFeasible: true,
    };
  }

  const labels = hardConstraintLabels(prefs);

  /**
   * Courses with NO published schedule at all (noFixedSchedule, e.g. Senior Project) are
   * never a scheduling constraint: they join every result as a trivially-satisfied
   * zero-meeting entry that contributes only credits. Nothing is invented for them.
   */
  const flexible = courses.filter((c) => c.noFixedSchedule === true);
  const fixed = courses.filter((c) => !c.noFixedSchedule);
  const flexibleEntries: ScheduleCourseEntry[] = flexible.map((course) => ({
    course,
    instructor: course.instructors[0],
    instructorIdx: 0,
    pairing: { meetings: [], labs: [], tutorials: [] },
  }));

  // Classify each course's zero-candidate case separately so the UI can explain WHY.
  const noSections: { courseId: string; code: string }[] = [];
  const blockedByHard: { courseId: string; code: string }[] = [];
  const perCourseCandidates = fixed.map((course) => {
    const all = countAllPairings(course);
    const viable = buildCandidates(course, prefs, picks, locks);
    if (viable.length === 0) {
      // Distinguish "publishes nothing schedulable" from "hard constraints excluded everything".
      if (all === 0) noSections.push({ courseId: course.id, code: course.code });
      else blockedByHard.push({ courseId: course.id, code: course.code });
    }
    return { course, candidates: viable };
  });

  if (noSections.length > 0 || blockedByHard.length > 0) {
    const hardActive = labels.length > 0;
    return {
      schedules: [],
      totalValid: 0,
      truncated: false,
      earlyExit: false,
      noSections,
      blockedByHard,
      unsatisfiableHard: labels.map((l) => l.label),
      // Hard constraints are only "unsatisfiable" if some were requested and blocked a course
      // that otherwise has sections. No hard constraints => nothing to be infeasible about.
      hardFeasible: !(hardActive && blockedByHard.length > 0),
    };
  }

  // Most-constrained-first ordering = strongest pruning.
  const planned = perCourseCandidates
    .map((c) => ({
      course: c.course,
      candidates: [...c.candidates].sort((a, b) => {
        const aEnd = Math.max(...a.pairing.meetings.map((m) => m.end));
        const bEnd = Math.max(...b.pairing.meetings.map((m) => m.end));
        return aEnd - bEnd;
      }),
    }))
    .sort((a, b) => a.candidates.length - b.candidates.length);

  const n = planned.length;

  // Search state: busy meetings per day for conflict checks, plus per-day class minutes so a
  // hard max-hours cap can be enforced across courses (not just within one course).
  const busy = new Map<Day, Meeting[]>();
  const dayMinutes = new Map<Day, number>();
  const hardLimitMin = prefs.maxHoursHard && prefs.maxHoursPerDay != null ? prefs.maxHoursPerDay * 60 : null;
  const hardCampusDays = prefs.campusDaysHard ? prefs.preferredCampusDays : null;

  const fits = (meetings: Meeting[]) => {
    const newlyUsed = new Set<Day>();
    for (const mt of meetings) {
      const arr = busy.get(mt.day);
      if (arr && arr.some((b) => overlaps(b, mt))) return false;
      if (hardLimitMin != null && (dayMinutes.get(mt.day) ?? 0) + (mt.end - mt.start) > hardLimitMin) return false;
      if ((busy.get(mt.day)?.length ?? 0) === 0) newlyUsed.add(mt.day);
    }
    if (hardCampusDays != null) {
      const currentlyUsed = [...busy.values()].filter((list) => list.length > 0).length;
      if (currentlyUsed + newlyUsed.size > hardCampusDays) return false;
    }
    return true;
  };

  const commit = (meetings: Meeting[]) =>
    meetings.forEach((mt) => {
      const arr = busy.get(mt.day);
      if (arr) arr.push(mt);
      else busy.set(mt.day, [mt]);
      dayMinutes.set(mt.day, (dayMinutes.get(mt.day) ?? 0) + (mt.end - mt.start));
    });

  const rollback = (meetings: Meeting[]) =>
    meetings.forEach((mt) => {
      const arr = busy.get(mt.day)!;
      arr.splice(arr.indexOf(mt), 1);
      dayMinutes.set(mt.day, (dayMinutes.get(mt.day) ?? 0) - (mt.end - mt.start));
    });

  let nodeCount = 0;
  let truncated = false;
  let earlyExit = false;
  let totalValid = 0;

  /** Bounded top-K pool of fully-built schedules, kept sorted best-first by score. */
  const pool: GeneratedSchedule[] = [];
  /**
   * Dedupe guard, bounded so it can never grow with the size of the search space. Duplicate
   * pairings within one course's data are the only realistic source of collision, and those
   * appear early — so a bounded FIFO window gives the benefit without the memory risk.
   */
  const seen = new Set<string>();
  const SEEN_LIMIT = 4096;
  const seenOrder: string[] = [];

  const worstScore = () => (pool.length < POOL_LIMIT ? Infinity : pool[pool.length - 1].scorePercent);

  const consider = (fixedEntries: ScheduleCourseEntry[]) => {
    totalValid++;

    // Zero-meeting (noFixedSchedule) courses join every schedule — credits only, no times.
    const entries = flexibleEntries.length > 0 ? [...fixedEntries, ...flexibleEntries] : fixedEntries;

    // Cheap ranking pass first — a full GeneratedSchedule is only built for genuine candidates,
    // so the pool bound also caps how much memory generation can ever allocate.
    const meetings = sortMeetings(entries.flatMap((e) => e.pairing.meetings));
    const metrics = measureSchedule(meetings);
    const ranked = scoreCandidate(meetings, metrics, prefs);

    if (pool.length >= POOL_LIMIT && ranked.percent <= worstScore()) return; // early reject

    const id = entries
      .map((e) => `${e.course.id}:${e.instructorIdx}:${e.pairing.meetings.map((m) => `${m.type[0]}${m.sec}`).join('+')}`)
      .join('|');
    if (seen.has(id)) return; // dedupe
    seen.add(id);
    seenOrder.push(id);
    if (seenOrder.length > SEEN_LIMIT) {
      const evicted = seenOrder.shift();
      if (evicted) seen.delete(evicted);
    }

    const schedule: GeneratedSchedule = {
      id,
      perCourse: entries.slice(),
      meetings,
      metrics,
      credits: entries.reduce((s, e) => s + (e.course.credits ?? 0), 0),
      scorePercent: ranked.percent,
      keepFreeViolations: ranked.keepFreeViolations,
      maxHoursViolationDays: ranked.maxHoursViolationDays,
      daySpans: buildDaySpans(meetings),
      /** Max class minutes in any single day — exact durations, used by Compare. */
      maxDayMinutes: Math.max(0, ...DAYS.map((d) => dayMinutesTotal(meetings, d))),
    };

    let idx = pool.findIndex((p) => schedule.scorePercent > p.scorePercent);
    if (idx === -1) {
      if (pool.length >= POOL_LIMIT) return;
      idx = pool.length;
    }
    pool.splice(idx, 0, schedule);
    if (pool.length > POOL_LIMIT) pool.length = POOL_LIMIT;
  };

  const walk = (i: number, acc: ScheduleCourseEntry[]) => {
    if (truncated) return;
    // Sound early exit: the pool is full of perfect scores, so nothing left in this subtree
    // can possibly rank higher. Saves exploring a potentially huge remainder of the tree.
    if (pool.length >= POOL_LIMIT && worstScore() >= 100) {
      earlyExit = true;
      truncated = true;
      return;
    }
    if (i === n) {
      consider(acc);
      return;
    }
    const { course, candidates } = planned[i];
    for (const cand of candidates) {
      nodeCount++;
      if (nodeCount > NODE_BUDGET) {
        truncated = true;
        return;
      }
      if (!fits(cand.pairing.meetings)) continue; // early conflict / hard-limit pruning
      commit(cand.pairing.meetings);
      acc.push({ course, instructor: cand.instructor, instructorIdx: cand.instructorIdx, pairing: cand.pairing });
      walk(i + 1, acc);
      acc.pop();
      rollback(cand.pairing.meetings);
      if (truncated) return;
    }
  };

  walk(0, []);

  // Hard constraints are enforced during candidate building and search, so every retained
  // schedule satisfies all of them. A global hard rule (notably maximum campus days) can
  // still make the cross-course search empty even though each course has viable sections.
  const schedules = pool.slice(0, RESULT_LIMIT);
  const hardActive = labels.length > 0;
  const globalHardImpossible = totalValid === 0 && hardActive;

  return {
    schedules,
    totalValid,
    truncated,
    earlyExit,
    noSections: [],
    blockedByHard: [],
    unsatisfiableHard: globalHardImpossible ? labels.map((l) => l.label) : [],
    hardFeasible: !globalHardImpossible,
  };
}

/** True while every course in `schedule` still matches exactly what's manually picked. */
export function scheduleMatchesPicks(
  schedule: GeneratedSchedule,
  uidOf: (m: Meeting) => string,
  picks: Record<string, { Lecture: string | null; Lab: string | null; Tutorial: string | null }>,
): boolean {
  return schedule.perCourse.every(({ course, pairing }) => {
    const pick = picks[course.id];
    if (!pick) return false;
    return (
      (pairing.lecture ? uidOf(pairing.lecture) : null) === pick.Lecture &&
      (pairing.labs[0] ? uidOf(pairing.labs[0]) : null) === pick.Lab &&
      (pairing.tutorials[0] ? uidOf(pairing.tutorials[0]) : null) === pick.Tutorial
    );
  });
}

export function scheduleLabel(index: number): string {
  return `Schedule ${String.fromCharCode(65 + index)}`;
}
