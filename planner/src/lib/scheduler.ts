import { measureSchedule } from './scheduler-parts/measure';
import type { ComboMetrics, Course, Day, GenerationResult, Instructor, Meeting, Pairing } from '../types';
import { overlaps } from './time';

export type { GenerationResult };

/** Hard safety cap so the UI can never freeze, no matter how the sections combine. */
export const MAX_COMBOS = 200_000;

/**
 * Budget for the full enumeration recount used to report the TRUE number of valid
 * combinations. Counting alone is cheap, but on pathological inputs it must not run
 * unbounded either — beyond this many leaves we report the capped figure instead.
 */
const COUNT_RECAP_BUDGET = 2_000_000;

/**
 * Budget for the bounded "best combo" scan used by Suggest Best Combination. The scan
 * stops after this many stored combinations and marks the result as best-so-far.
 */
const BEST_SCAN_LIMIT = 20_000;

/* ------------------------------------------------------------------ */
/* 1. Valid pairings inside a single course                            */
/* ------------------------------------------------------------------ */

interface PlannedCourse {
  courseId: string;
  pairings: Pairing[];
}

/**
 * Generate every conflict-free combination across the selected courses.
 * Courses are ordered most-constrained-first and each course's pairings are
 * pre-sorted so the search finds valid leaves quickly; branches that clash on a
 * real time interval are pruned immediately.
 */
export function generateCombinations(
  entries: { course: Course; instructor?: Instructor; pairings: Pairing[] }[],
): GenerationResult {
  const blocked = entries
    .filter((e) => e.pairings.length === 0)
    .map((e) => ({ courseId: e.course.id, instructor: e.instructor?.name ?? '—' }));
  if (blocked.length > 0 || entries.length === 0) {
    return {
      flat: [],
      count: 0,
      courseCount: entries.length,
      truncated: false,
      blocked,
      order: [],
      pairingsByCourse: {},
    };
  }

  // Most-constrained-first ordering = stronger pruning.
  const planned: PlannedCourse[] = entries
    .map((e) => ({ courseId: e.course.id, pairings: rankPairings(e.pairings) }))
    .sort((a, b) => a.pairings.length - b.pairings.length);

  const n = planned.length;
  const flat: number[] = [];
  let count = 0;
  let truncated = false;

  // Busy meetings per day for the partial solution.
  const busy = new Map<Day, Meeting[]>();

  const fits = (meetings: Meeting[]): boolean =>
    meetings.every((mt) => !(busy.get(mt.day) ?? []).some((b) => overlaps(b, mt)));

  const commit = (meetings: Meeting[]) => {
    for (const mt of meetings) {
      const arr = busy.get(mt.day);
      if (arr) arr.push(mt);
      else busy.set(mt.day, [mt]);
    }
  };
  const rollback = (meetings: Meeting[]) => {
    for (const mt of meetings) {
      const arr = busy.get(mt.day)!;
      arr.splice(arr.indexOf(mt), 1);
    }
  };

  const walk = (i: number, prefix: number[]) => {
    if (truncated) return;
    if (i === n) {
      count++;
      if (count <= MAX_COMBOS) {
        for (const v of prefix) flat.push(v);
      } else {
        truncated = true;
      }
      return;
    }
    const { pairings } = planned[i];
    for (let p = 0; p < pairings.length; p++) {
      const meetings = pairings[p].meetings;
      if (!fits(meetings)) continue; // ← prune: real interval conflict
      commit(meetings);
      prefix.push(p);
      walk(i + 1, prefix);
      prefix.pop();
      rollback(meetings);
      if (truncated) return;
    }
  };

  walk(0, []);

  const pairingsByCourse: Record<string, Pairing[]> = {};
  planned.forEach((p) => {
    pairingsByCourse[p.courseId] = p.pairings;
  });

  if (!truncated) {
    return {
      flat,
      count,
      courseCount: n,
      truncated: false,
      countCapped: false,
      blocked: [],
      order: planned.map((p) => p.courseId),
      pairingsByCourse,
    };
  }

  // Storage cap reached: re-walk without storing to report the total — but with its own
  // budget, so even the recount can never block the UI on a pathological search space.
  let total = 0;
  let countCapped = false;
  busy.clear();
  const countOnly = (i: number): boolean => {
    if (total > COUNT_RECAP_BUDGET) {
      countCapped = true;
      return false; // stop the whole walk
    }
    if (i === n) {
      total++;
      return true;
    }
    for (const pairing of planned[i].pairings) {
      if (!fits(pairing.meetings)) continue;
      commit(pairing.meetings);
      const goOn = countOnly(i + 1);
      rollback(pairing.meetings);
      if (!goOn) return false;
    }
    return true;
  };
  countOnly(0);

  return {
    flat: flat.slice(0, MAX_COMBOS * n),
    count: countCapped ? total : Math.max(total, count),
    courseCount: n,
    truncated: true,
    countCapped,
    blocked: [],
    order: planned.map((p) => p.courseId),
    pairingsByCourse,
  };
}

/** Pairings that finish earlier and use fewer days are explored first. */
function rankPairings(pairings: Pairing[]): Pairing[] {
  return [...pairings].sort((a, b) => {
    const aEnd = Math.max(...a.meetings.map((m) => m.end));
    const bEnd = Math.max(...b.meetings.map((m) => m.end));
    if (aEnd !== bEnd) return aEnd - bEnd;
    const aStart = Math.min(...a.meetings.map((m) => m.start));
    const bStart = Math.min(...b.meetings.map((m) => m.start));
    return aStart - bStart;
  });
}

export function comboAt(result: GenerationResult, index: number): number[] | null {
  const { flat, courseCount, count } = result;
  if (index < 0 || index >= count || courseCount === 0) return null;
  if (index * courseCount + courseCount > flat.length) return null; // truncated tail
  return flat.slice(index * courseCount, index * courseCount + courseCount);
}

/* ------------------------------------------------------------------ */
/* 3. Schedule metrics + heuristic ranking                             */
/* ------------------------------------------------------------------ */

/**
 * Find the best-ranked stored combination for the current instructor groups.
 *
 * Bounded on purpose: at most BEST_SCAN_LIMIT stored combinations are measured and a
 * small top-K pool is retained, so "Suggest Best Combination" stays instant even when
 * the generator stored hundreds of thousands of results. When the scan hits its limit
 * the UI says so instead of claiming global optimality.
 */
export function findBestCombo(
  result: GenerationResult,
): { index: number; metrics: ComboMetrics; scanned: number; complete: boolean } | null {
  const first = comboAt(result, 0);
  if (!first) return null;

  let bestIndex = 0;
  let bestScore = Infinity;
  let bestMetrics: ComboMetrics | null = null;

  const limit = Math.min(result.count, result.truncated ? Math.floor(result.flat.length / Math.max(1, result.courseCount)) : result.count, BEST_SCAN_LIMIT);
  const scratch: Meeting[] = [];

  for (let i = 0; i < limit; i++) {
    const indices = comboAt(result, i);
    if (!indices) break;
    scratch.length = 0;
    indices.forEach((p, ci) => {
      const pairing = result.pairingsByCourse[result.order[ci]]?.[p];
      if (pairing) scratch.push(...pairing.meetings);
    });
    const metrics = measureSchedule(scratch);
    if (metrics.score < bestScore) {
      bestScore = metrics.score;
      bestIndex = i;
      bestMetrics = metrics;
    }
  }

  return bestMetrics
    ? { index: bestIndex, metrics: bestMetrics, scanned: limit, complete: limit >= result.count }
    : null;
}
