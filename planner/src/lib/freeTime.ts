import type { Day, Meeting } from '../types';
import { DAYS, DAY_LABEL } from './time';

/**
 * The fixed daily availability window used by the Free Time figure.
 * Sunday–Thursday, 08:00–18:00. Declared here once and surfaced in the UI so the
 * number is understandable rather than magical.
 */
export const WINDOW_START = 8 * 60;
export const WINDOW_END = 18 * 60;
export const TEACHING_DAYS: Day[] = DAYS;
export const WINDOW_MINUTES_PER_DAY = WINDOW_END - WINDOW_START;
export const WINDOW_MINUTES_TOTAL = WINDOW_MINUTES_PER_DAY * TEACHING_DAYS.length;

export interface DayFreeTime {
  day: Day;
  /** Minutes of that day's window actually occupied by class time (interval union). */
  occupied: number;
  /** WINDOW_MINUTES_PER_DAY - occupied. */
  freeMinutes: number;
  hasClass: boolean;
}

export interface FreeTimeResult {
  /** Free minutes across the whole teaching week. */
  freeMinutes: number;
  /** Same, in hours with one decimal — never rounded up to a fake whole hour. */
  freeHours: number;
  occupiedMinutes: number;
  windowMinutes: number;
  freeDays: number;
  classDays: number;
  perDay: DayFreeTime[];
  /**
   * Class minutes that fell outside the declared window. Reported for transparency;
   * they are NOT subtracted from the window twice.
   */
  outsideWindowMinutes: number;
  /** Minutes of double-booked overlap (two classes at once) — counted only once. */
  overlapMinutes: number;
}

function clip(start: number, end: number): [number, number] | null {
  const s = Math.max(start, WINDOW_START);
  const e = Math.min(end, WINDOW_END);
  return e > s ? [s, e] : null;
}

/**
 * Total length of the union of a day's intervals.
 * This is the fix for double-counting: two overlapping 1-hour classes occupy
 * 60 minutes of the day, not 120. Back-to-back classes merge cleanly.
 */
function unionMinutes(intervals: [number, number][]): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = sorted[0][0];
  let curEnd = sorted[0][1];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  total += curEnd - curStart;
  return total;
}

/** Raw overlap between intervals, ignoring the window — used only for the diagnostic figure. */
function rawOverlapMinutes(intervals: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const overlap = Math.min(intervals[i][1], intervals[j][1]) - Math.max(intervals[i][0], intervals[j][0]);
      if (overlap > 0) sum += overlap;
    }
  }
  return sum;
}

/**
 * Free Time = available schedule-window time − actual occupied class time.
 *
 * - Uses each class's real start/end, so 8:00–9:00 occupies exactly 1 hour and
 *   10:30–12:00 occupies exactly 1.5 hours.
 * - Overlapping (conflicting) classes are counted once, because a student can only
 *   physically be in one place — their schedule is not "twice as busy".
 * - Days with no classes are fully free.
 */
export function computeFreeTime(meetings: Meeting[]): FreeTimeResult {
  const byDay = new Map<Day, [number, number][]>();
  let outsideWindowMinutes = 0;

  meetings.forEach((m) => {
    const raw = m.end - m.start;
    const clipped = clip(m.start, m.end);
    if (raw - (clipped ? clipped[1] - clipped[0] : 0) > 0) {
      outsideWindowMinutes += raw - (clipped ? clipped[1] - clipped[0] : 0);
    }
    if (!clipped) return;
    const arr = byDay.get(m.day);
    if (arr) arr.push(clipped);
    else byDay.set(m.day, [clipped]);
  });

  const perDay: DayFreeTime[] = TEACHING_DAYS.map((day) => {
    const intervals = byDay.get(day) ?? [];
    const occupied = unionMinutes(intervals);
    return {
      day,
      occupied,
      free: WINDOW_MINUTES_PER_DAY - occupied,
      freeMinutes: WINDOW_MINUTES_PER_DAY - occupied,
      hasClass: intervals.length > 0,
    };
  });

  const occupiedMinutes = perDay.reduce((s, d) => s + d.occupied, 0);
  const freeMinutes = Math.max(0, WINDOW_MINUTES_TOTAL - occupiedMinutes);

  return {
    freeMinutes,
    freeHours: Math.round((freeMinutes / 60) * 10) / 10,
    occupiedMinutes,
    windowMinutes: WINDOW_MINUTES_TOTAL,
    freeDays: perDay.filter((d) => !d.hasClass).length,
    classDays: perDay.filter((d) => d.hasClass).length,
    perDay,
    outsideWindowMinutes,
    overlapMinutes: rawOverlapMinutes(meetings.map((m) => [m.start, m.end] as [number, number])),
  };
}

export function dayLabel(day: Day): string {
  return DAY_LABEL[day];
}
