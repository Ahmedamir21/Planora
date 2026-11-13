import type { ComboMetrics, Day, Meeting } from '../../types';
import { sortMeetings } from '../time';

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
