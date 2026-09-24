import type {
  ComboMetrics,
  Course,
  Day,
  GenerationResult,
  Instructor,
  Meeting,
  MeetingType,
  Pairing,
} from '../types';
import { uid } from './picks';
import { overlaps, sortMeetings } from './time';

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

/**
 * Cross-instructor pairing pool for one course: every published lecture, lab and
 * tutorial of the course, whatever instructor teaches it, plus the instructor index
 * that owns each option (for display and filters). Same-uid duplicates published under
 * two groups collapse to one entry (same section, same time = the same class).
 */
export function buildCourseOptions(course: Course) {
  const pools: Record<MeetingType, { meeting: Meeting; instrIdx: number }[]> = { Lecture: [], Lab: [], Tutorial: [] };
  const seen: Record<MeetingType, Set<string>> = { Lecture: new Set(), Lab: new Set(), Tutorial: new Set() };
  course.instructors.forEach((instructor, instrIdx) => {
    (['Lecture', 'Lab', 'Tutorial'] as MeetingType[]).forEach((kind) => {
      const src = kind === 'Lecture' ? instructor.lectures : kind === 'Lab' ? instructor.labs : instructor.tutorials;
      src.forEach((meeting) => {
        const key = uid(meeting);
        if (seen[kind].has(key)) return;
        seen[kind].add(key);
        pools[kind].push({ meeting, instrIdx });
      });
    });
  });
  return pools;
}

/**
 * Build every internally conflict-free combination of the components the course
 * publishes — ACROSS instructor groups. A lecture from one teacher may be paired with
 * a lab or tutorial from another; the ONLY exclusion rule is a real time overlap
 * between the component meetings (day/time), which mirrors exactly how the cross-course
 * search prunes. Components that do not exist are never invented: if the course has
 * labs, every combination contains one lecture-sized pick per published type, and a
 * lecture-only course yields lecture-only pairings. Section numbers are NOT assumed to
 * match across groups.
 */
export function buildCoursePairings(course: Course): Pairing[] {
  const pools = buildCourseOptions(course);
  const groups: { kind: MeetingType; items: { meeting: Meeting; instrIdx: number }[] }[] = (
    ['Lecture', 'Lab', 'Tutorial'] as MeetingType[]
  )
    .map((kind) => ({ kind, items: pools[kind] }))
    .filter((g) => g.items.length > 0);
  if (groups.length === 0) return [];

  let acc: { meetings: Meeting[]; owners: Partial<Record<MeetingType, number>> }[] = [{ meetings: [], owners: {} }];
  for (const group of groups) {
    const next: { meetings: Meeting[]; owners: Partial<Record<MeetingType, number>> }[] = [];
    for (const base of acc) {
      for (const candidate of group.items) {
        // Internal (same course) overlap → rejected, no matter who teaches either side.
        if (base.meetings.some((b) => overlaps(b, candidate.meeting))) continue;
        next.push({
          meetings: [...base.meetings, candidate.meeting],
          owners: { ...base.owners, [group.kind]: candidate.instrIdx },
        });
      }
    }
    if (next.length === 0) return [];
    acc = next;
  }

  return acc.map(({ meetings, owners }) => {
    const sorted = sortMeetings(meetings);
    return {
      meetings: sorted,
      lecture: sorted.find((x) => x.type === 'Lecture'),
      labs: sorted.filter((x) => x.type === 'Lab'),
      tutorials: sorted.filter((x) => x.type === 'Tutorial'),
      instructors: owners,
    };
  });
}

/**
 * Build every internally conflict-free combination of the components that
 * actually exist for this instructor (lecture × lab × tutorial).
 *
 * Kept for the engine audit and group-level views — the student-facing candidate
 * space is now buildCoursePairings(), which does NOT require one instructor.
 *
 * Components that do not exist are never invented: an instructor with a lecture
 * and no labs yields lecture-only pairings, and an instructor with labs and no
 * lecture yields lab-only pairings. Section numbers are NOT assumed to match.
 */

/**
 * Build every internally conflict-free combination of the components that
 * actually exist for this instructor (lecture × lab × tutorial).
 *
 * Components that do not exist are never invented: an instructor with a lecture
 * and no labs yields lecture-only pairings, and an instructor with labs and no
 * lecture yields lab-only pairings. Section numbers are NOT assumed to match.
 */
export function buildPairings(instr: Instructor): Pairing[] {
  const groups: Meeting[][] = [];
  if (instr.lectures.length) groups.push(instr.lectures);
  if (instr.labs.length) groups.push(instr.labs);
  if (instr.tutorials.length) groups.push(instr.tutorials);
  if (groups.length === 0) return [];

  let acc: Meeting[][] = [[]];
  for (const group of groups) {
    const next: Meeting[][] = [];
    for (const base of acc) {
      for (const candidate of group) {
        // Internal (same course) overlap → rejected. Non-credit meetings count.
        if (base.some((b) => overlaps(b, candidate))) continue;
        next.push([...base, candidate]);
      }
    }
    if (next.length === 0) return [];
    acc = next;
  }

  return acc.map((meetings) => {
    const sorted = sortMeetings(meetings);
    return {
      meetings: sorted,
      lecture: sorted.find((x) => x.type === 'Lecture'),
      labs: sorted.filter((x) => x.type === 'Lab'),
      tutorials: sorted.filter((x) => x.type === 'Tutorial'),
    };
  });
}

/* ------------------------------------------------------------------ */
/* 2. Combination generation (backtracking + pruning)                  */
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

export function measureSchedule(meetings: Meeting[]): ComboMetrics {
  if (meetings.length === 0) {
    return {
      score: 0,
      days: 0,
      isolatedDays: 0,
      gapMinutes: 0,
      spanMinutes: 0,
      meetingMinutes: 0,
      earliest: null,
      latest: null,
      sessions: 0,
    };
  }

  const byDay = new Map<Day, Meeting[]>();
  for (const m of meetings) {
    const arr = byDay.get(m.day);
    if (arr) arr.push(m);
    else byDay.set(m.day, [m]);
  }

  let gapMinutes = 0;
  let spanMinutes = 0;
  let meetingMinutes = 0;
  let isolatedDays = 0;

  for (const [, list] of byDay) {
    const sorted = sortMeetings(list);
    for (const m of sorted) meetingMinutes += m.end - m.start; // exact end − start, no padding
    spanMinutes += sorted[sorted.length - 1].end - sorted[0].start;
    if (sorted.length === 1) isolatedDays++;
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].start - sorted[i - 1].end;
      if (gap > 0) gapMinutes += gap;
    }
  }

  const earliest = Math.min(...meetings.map((m) => m.start));
  const latest = Math.max(...meetings.map((m) => m.end));
  const days = byDay.size;

  /**
   * Heuristic preference order (lower = better). It is an explicit weighting,
   * not a claim of objective optimality:
   *   1. fewer campus days            10 000 / day
   *   2. no single-session days        2 500 / isolated day
   *   3. fewer idle minutes on campus     30 / gap minute
   *   4. more compact days                 8 / span minute
   *   5. fewer occupied minutes            1 / meeting minute
   *   6. earlier finish / later start      2 / 0.5 per minute past 8 AM
   */
  const score =
    days * 10_000 +
    isolatedDays * 2_500 +
    gapMinutes * 30 +
    spanMinutes * 8 +
    meetingMinutes * 1 +
    Math.max(0, latest - 480) * 2 +
    Math.max(0, 1_080 - earliest) * 0.5;

  return {
    score,
    days,
    isolatedDays,
    gapMinutes,
    spanMinutes,
    meetingMinutes,
    earliest,
    latest,
    sessions: meetings.length,
  };
}

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
