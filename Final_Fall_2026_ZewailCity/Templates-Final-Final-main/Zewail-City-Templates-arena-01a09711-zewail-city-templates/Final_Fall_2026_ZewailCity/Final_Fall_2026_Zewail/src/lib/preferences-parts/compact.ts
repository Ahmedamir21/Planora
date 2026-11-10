import { DEFAULT_PREFERENCES, GOAL_ORDER, VALID_DAYS, mergeWithDefaults, sanitizePreferences } from '../preferences';
import type { ScheduleGoal, SchedulePreferences } from '../preferences';
import type { Day } from '../../types';

export interface CompactPreferences {
  g?: ScheduleGoal[];
  pd?: Day[];
  kf?: Day[];
  ps?: number;
  pe?: number;
  nb?: number;
  nbs?: 1;
  na?: number;
  nas?: 1;
  mh?: number;
  /** Preferred campus days per week (2–5). */
  cd?: number;
  /** Hard-constraint flags, emitted only when set. */
  hd?: ('pd' | 'kf' | 'tr' | 'mh' | 'cd')[];
}

export const HARD_CODES = ['pd', 'kf', 'tr', 'mh', 'cd'] as const;
export type HardCode = (typeof HARD_CODES)[number];

/** Only emits fields that differ from the defaults, keeping share links short. */
export function toCompactPreferences(p: SchedulePreferences): CompactPreferences | undefined {
  const out: CompactPreferences = {};
  const enabledGoals = GOAL_ORDER.filter((g) => p.goals[g]);
  const defaultGoals = GOAL_ORDER.filter((g) => DEFAULT_PREFERENCES.goals[g]);
  if (JSON.stringify(enabledGoals) !== JSON.stringify(defaultGoals)) out.g = enabledGoals;
  if (p.preferredDays.length) out.pd = p.preferredDays;
  if (p.keepFreeDays.length) out.kf = p.keepFreeDays;
  if (p.preferredStart != null) out.ps = p.preferredStart;
  if (p.preferredEnd != null) out.pe = p.preferredEnd;
  if (p.noBefore != null) out.nb = p.noBefore;
  if (p.noBeforeStrict) out.nbs = 1;
  if (p.noAfter != null) out.na = p.noAfter;
  if (p.noAfterStrict) out.nas = 1;
  if (p.maxHoursPerDay != null) out.mh = p.maxHoursPerDay;
  if (p.preferredCampusDays != null) out.cd = p.preferredCampusDays;
  const hard: HardCode[] = [];
  if (p.preferredDaysHard) hard.push('pd');
  if (p.keepFreeDaysHard) hard.push('kf');
  if (p.timeRangeHard) hard.push('tr');
  if (p.maxHoursHard) hard.push('mh');
  if (p.campusDaysHard) hard.push('cd');
  if (hard.length) out.hd = hard;
  return Object.keys(out).length > 0 ? out : undefined;
}

export function fromCompactPreferences(c: CompactPreferences | null | undefined): SchedulePreferences {
  if (!c) return mergeWithDefaults(null);
  const goals = { ...DEFAULT_PREFERENCES.goals };
  if (Array.isArray(c.g)) {
    // Only accept known goal ids — an unknown value from a newer/older link must not corrupt state.
    GOAL_ORDER.forEach((g) => (goals[g] = c.g!.includes(g)));
  }
  const hardList = Array.isArray(c.hd) ? c.hd.filter((x): x is HardCode => HARD_CODES.includes(x as HardCode)) : [];
  return sanitizePreferences({
    goals,
    preferredDays: Array.isArray(c.pd) ? c.pd.filter((d): d is Day => VALID_DAYS.includes(d)) : [],
    keepFreeDays: Array.isArray(c.kf) ? c.kf.filter((d): d is Day => VALID_DAYS.includes(d)) : [],
    preferredStart: typeof c.ps === 'number' ? c.ps : null,
    preferredEnd: typeof c.pe === 'number' ? c.pe : null,
    noBefore: typeof c.nb === 'number' ? c.nb : null,
    noBeforeStrict: !!c.nbs,
    noAfter: typeof c.na === 'number' ? c.na : null,
    noAfterStrict: !!c.nas,
    maxHoursPerDay: typeof c.mh === 'number' ? c.mh : null,
    preferredCampusDays: typeof c.cd === 'number' ? c.cd : null,
    campusDaysHard: hardList.includes('cd'),
    preferredDaysHard: hardList.includes('pd'),
    keepFreeDaysHard: hardList.includes('kf'),
    timeRangeHard: hardList.includes('tr'),
    maxHoursHard: hardList.includes('mh'),
  });
}

/**
 * Overlay the small set of reusable Assistant constraint chips onto the normal
 * planner preferences. The base preferences are never mutated.
 *
 * Canonical labels intentionally stay human-readable so the same value can be
 * shown as a removable chip in the UI and interpreted deterministically here.
 */
export function withAssistantConstraints(
  base: SchedulePreferences,
  constraints: string[] | null | undefined,
): SchedulePreferences {
  if (!constraints?.length) return base;

  const next: SchedulePreferences = {
    ...base,
    goals: { ...base.goals },
    preferredDays: [...base.preferredDays],
    keepFreeDays: [...base.keepFreeDays],
  };

  const dayMap: Record<string, Day> = {
    sunday: 'Sun',
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    sun: 'Sun',
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
  };

  const parseClock = (hourRaw: string, minuteRaw?: string, ampmRaw?: string): number | null => {
    let hour = Number(hourRaw);
    const minute = minuteRaw ? Number(minuteRaw) : 0;
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
    const ampm = ampmRaw?.toLowerCase();
    if (ampm) {
      if (hour < 1 || hour > 12) return null;
      if (ampm === 'pm' && hour !== 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
    } else if (hour < 0 || hour > 23) {
      return null;
    }
    return hour * 60 + minute;
  };

  constraints.forEach((raw) => {
    const value = raw.trim();
    const lower = value.toLowerCase();

    // "Avoid 8 AM" means no meeting may start before 9:00 AM.
    const avoidHour = lower.match(/^avoid\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (avoidHour) {
      const at = parseClock(avoidHour[1], avoidHour[2], avoidHour[3]);
      if (at != null) {
        next.noBefore = Math.max(next.noBefore ?? 0, at + 60);
        next.noBeforeStrict = true;
      }
      return;
    }

    const keepFree = lower.match(/^keep\s+(sunday|monday|tuesday|wednesday|thursday|sun|mon|tue|wed|thu)\s+free$/i);
    if (keepFree) {
      const day = dayMap[keepFree[1].toLowerCase()];
      if (day && !next.keepFreeDays.includes(day)) next.keepFreeDays.push(day);
      next.keepFreeDaysHard = true;
      return;
    }

    const finish = lower.match(/^(?:finish\s+(?:by|before)|no\s+classes\s+after)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (finish) {
      const at = parseClock(finish[1], finish[2], finish[3]);
      if (at != null) {
        next.noAfter = next.noAfter == null ? at : Math.min(next.noAfter, at);
        next.noAfterStrict = true;
      }
      return;
    }

    const start = lower.match(/^(?:start\s+after|no\s+classes\s+before)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (start) {
      const at = parseClock(start[1], start[2], start[3]);
      if (at != null) {
        next.noBefore = Math.max(next.noBefore ?? 0, at);
        next.noBeforeStrict = true;
      }
      return;
    }

    const campusDays = lower.match(/^max\s+([2-5])\s+campus\s+days$/i);
    if (campusDays) {
      next.preferredCampusDays = Number(campusDays[1]);
      next.campusDaysHard = true;
      return;
    }

    const maxHours = lower.match(/^max\s+(\d+(?:\.\d+)?)\s+hours(?:\/day|\s+per\s+day)$/i);
    if (maxHours) {
      const hours = Number(maxHours[1]);
      if (Number.isFinite(hours) && hours >= 1 && hours <= 12) {
        next.maxHoursPerDay = hours;
        next.maxHoursHard = true;
      }
    }
  });

  return sanitizePreferences(next);
}
