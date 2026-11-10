import { hardConstraintLabels } from './bestSchedule-parts/hardConstraints';
import { buildCandidates, buildDaySpans, countAllPairings, dayMinutesTotal, scoreCandidate } from './bestSchedule-parts/scoring';
import type { BestScheduleReport, GeneratedSchedule, ScheduleCourseEntry } from './bestSchedule-parts/types';
import type { Course, Day, Meeting } from '../types';
import { measureSchedule } from './scheduler-parts/measure';
import { DAYS, overlaps, sortMeetings } from './time';
import type { SchedulePreferences } from './preferences';
import type { PickState } from './picks';
import { type PlannerLocks } from './assistantControls';

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

// kept so other files can still import these from here
export type { ScheduleCourseEntry, DaySpan, GeneratedSchedule, BestScheduleReport } from './bestSchedule-parts/types';
export { hardConstraintsActive } from './bestSchedule-parts/hardConstraints';
