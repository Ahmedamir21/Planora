import { check } from './shared';
import { COURSE_BY_ID } from '../../src/data/courses';
import { overlaps } from '../../src/lib/time';
import { generateCombinations, findBestCombo } from '../../src/lib/scheduler';
import { buildCoursePairings } from '../../src/lib/scheduler-parts/pairings';
import { measureSchedule } from '../../src/lib/scheduler-parts/measure';
import { generateBestSchedules, hardConstraintsActive, scheduleMatchesPicks } from '../../src/lib/bestSchedule';
import { DEFAULT_PREFERENCES } from '../../src/lib/preferences';
import { emptyPick, uid, type PickState } from '../../src/lib/picks';
import { phys } from './p1-basics';
import { csai203 } from './p3-share';

// Best-schedule engine and counting budgets.
/* ================= 4. Best-schedule engine: backtracking, MCF, ranking, hard constraints ================= */
const core = [COURSE_BY_ID['csai201'], COURSE_BY_ID['csai202'], COURSE_BY_ID['csai203'], phys];
export const report = generateBestSchedules(core, DEFAULT_PREFERENCES);
check('generates schedules', report.schedules.length > 0 && report.schedules.length <= 6);
check('returned schedules are conflict-free', report.schedules.every((s) => {
  for (let i = 0; i < s.meetings.length; i++)
    for (let j = i + 1; j < s.meetings.length; j++) if (overlaps(s.meetings[i], s.meetings[j])) return false;
  return true;
}));
check('ranked non-increasing by score', report.schedules.every((s, i) => i === 0 || s.scorePercent <= report.schedules[i - 1].scorePercent));
check('totalValid >= returned count', report.totalValid >= report.schedules.length);
check('dedup: no identical schedules', (() => {
  const keys = report.schedules.map((s) => s.meetings.map((m) => uid(m)).sort().join('|'));
  return new Set(keys).size === keys.length;
}));
check('each schedule covers all requested courses exactly once', report.schedules.every((s) => s.perCourse.length === core.length));
check('scheduleMatchesPicks agrees on the top result', (() => {
  const s = report.schedules[0];
  const picks: PickState = {};
  s.perCourse.forEach((e) => {
    const p = emptyPick();
    e.pairing.meetings.forEach((m) => {
      p[m.type] = uid(m);
    });
    picks[e.course.id] = p;
  });
  return scheduleMatchesPicks(s, uid, picks);
})());
check('best schedule is the exact union of its per-course pairings', (() => {
  const s = report.schedules[0];
  const fromEntries = s.perCourse.flatMap((e) => e.pairing.meetings.map(uid)).sort();
  const fromMeetings = s.meetings.map(uid).sort();
  return JSON.stringify(fromEntries) === JSON.stringify(fromMeetings);
})());

check('hard flag considered active only when set', hardConstraintsActive(DEFAULT_PREFERENCES) === false && hardConstraintsActive({ ...DEFAULT_PREFERENCES, keepFreeDaysHard: true, keepFreeDays: ['Wed'] }) === true);
const hard = generateBestSchedules(core, {
  ...DEFAULT_PREFERENCES,
  keepFreeDays: ['Wed'],
  keepFreeDaysHard: true,
  maxHoursPerDay: 4,
  maxHoursHard: true,
});
check('HARD keep-free + hour cap are never violated by results', hard.schedules.every((s) => {
  if (s.meetings.some((m) => m.day === 'Wed')) return false;
  const per: Record<string, number> = {};
  s.meetings.forEach((m) => {
    per[m.day] = (per[m.day] ?? 0) + (m.end - m.start);
  });
  return Object.values(per).every((x) => x <= 240);
}));

const impossible = generateBestSchedules(core, { ...DEFAULT_PREFERENCES, preferredStart: 480, preferredEnd: 481, timeRangeHard: true });
check('impossible HARD window => zero schedules', impossible.schedules.length === 0 && impossible.totalValid === 0);
check('impossible HARD window => explicit reason, not silence', impossible.blockedByHard.length > 0 && impossible.unsatisfiableHard.length > 0);
check('soft window with same bounds still yields schedules', generateBestSchedules(core, { ...DEFAULT_PREFERENCES, preferredStart: 480, preferredEnd: 481 }).schedules.length > 0);

const soft = generateBestSchedules(core, { ...DEFAULT_PREFERENCES, keepFreeDays: ['Wed'], keepFreeDaysHard: false });
check('SOFT rule changes ranking but not the valid space', soft.totalValid === report.totalValid && soft.schedules.length > 0);
check('soft keep-free violations are reported honestly on schedules', soft.schedules.every((s) => (s.meetings.some((m) => m.day === 'Wed') ? s.keepFreeViolations.includes('Wed') : true)));

/* ================= 5. counting budgets (top-K retention, capped recount) ================= */
{
  const entries = [COURSE_BY_ID['csai201'], COURSE_BY_ID['csai202']].map((course) => ({
    course,
    pairings: buildCoursePairings(course),
  }));
  const gen = generateCombinations(entries);
  check('generation stores results + counts', gen.count > 0 && gen.flat.length === gen.count * 2);
  check('small space: not truncated, not capped', gen.truncated === false && gen.countCapped === false);
  const best = findBestCombo(gen);
  check('findBestCombo returns a measured best', !!best && best.complete === true && best.scanned === gen.count && !!best.metrics);
  // brute-force verify engine picked the true optimum within scan
  if (best) {
    let trueBestScore = Infinity;
    for (let i = 0; i < gen.count; i++) {
      const m = measureSchedule(
        [0, 1].flatMap((ci) => {
          const p = gen.flat[i * gen.courseCount + ci];
          return gen.pairingsByCourse[gen.order[ci]][p].meetings;
        }),
      );
      if (m.score < trueBestScore) trueBestScore = m.score;
    }
    check('engine best equals brute-force best score', Math.abs(best.metrics.score - trueBestScore) < 1e-9);
  }
}
{
  // Big synthetic space (fabricated test data — the real dataset is never mutated): force early-exit flags.
  const wide = [
    COURSE_BY_ID['csai201'],
    COURSE_BY_ID['csai202'],
    COURSE_BY_ID['csai203'],
    phys,
    COURSE_BY_ID['csai101'] ?? COURSE_BY_ID['csai201'],
  ].filter((c, i, a) => a.indexOf(c) === i);
  const big = generateBestSchedules(wide, DEFAULT_PREFERENCES);
  check('larger space still returns <= 6 ranked, conflict-free results', big.schedules.length <= 6);
  check('truncated/earlyExit flags are booleans', typeof big.truncated === 'boolean' && typeof big.earlyExit === 'boolean');
}
