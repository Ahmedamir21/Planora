import type { Day } from '../types';

/** Only these day codes are ever accepted from a share URL or saved state. */
export const VALID_DAYS: Day[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

export type ScheduleGoal = 'minimizeGaps' | 'maximizeFreeDays' | 'earliestFinish' | 'latestStart';

export const GOAL_LABEL: Record<ScheduleGoal, string> = {
  minimizeGaps: 'Minimize gaps',
  maximizeFreeDays: 'Maximize free days',
  earliestFinish: 'Earliest finish',
  latestStart: 'Latest start',
};

export const GOAL_ORDER: ScheduleGoal[] = ['minimizeGaps', 'maximizeFreeDays', 'earliestFinish', 'latestStart'];

export interface SchedulePreferences {
  goals: Record<ScheduleGoal, boolean>;
  /** Days the student is fine with having class on. Empty = no preference either way. */
  preferredDays: Day[];
  /** Days to strongly try to keep completely free. */
  keepFreeDays: Day[];
  /** Soft preferred window, minutes since midnight. */
  preferredStart: number | null;
  preferredEnd: number | null;
  /** "No classes before/after" — soft by default, hard filter when the matching *Strict flag is on. */
  noBefore: number | null;
  noBeforeStrict: boolean;
  noAfter: number | null;
  noAfterStrict: boolean;
  /** Maximum class hours in a single day. */
  maxHoursPerDay: number | null;
  /**
   * Desired number of campus days per week (2–5). Soft by default: ranking prefers
   * schedules closest to this number. When campusDaysHard is on, it becomes a maximum.
   */
  preferredCampusDays: number | null;
  campusDaysHard: boolean;

  /**
   * Hard-constraint switches. Every preference is SOFT by default (it only influences
   * ranking); flipping the matching `hard` flag makes it a requirement that must hold,
   * and the generator reports "no valid schedules match your required constraints"
   * instead of silently ignoring it.
   */
  preferredDaysHard: boolean;
  keepFreeDaysHard: boolean;
  timeRangeHard: boolean;
  maxHoursHard: boolean;
}

export const DEFAULT_PREFERENCES: SchedulePreferences = {
  goals: { minimizeGaps: true, maximizeFreeDays: true, earliestFinish: false, latestStart: false },
  preferredDays: [],
  keepFreeDays: [],
  preferredStart: null,
  preferredEnd: null,
  noBefore: null,
  noBeforeStrict: false,
  noAfter: null,
  noAfterStrict: false,
  maxHoursPerDay: null,
  preferredCampusDays: null,
  campusDaysHard: false,
  preferredDaysHard: false,
  keepFreeDaysHard: false,
  timeRangeHard: false,
  maxHoursHard: false,
};

const STORAGE_KEY = 'zw-schedule-prefs-v1';

function clampMinute(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  if (n < 0 || n > 24 * 60) return null;
  return n;
}

function bool(v: unknown): boolean {
  return v === true;
}

/**
 * Full structural validation of an unknown object shaped like SchedulePreferences.
 * Every persisted or URL-supplied preferences blob passes through here, so a
 * corrupted, partial or hand-tampered payload can never reach the scoring engine
 * with, e.g., a missing `goals` map (which used to throw) or an out-of-range minute.
 */
export function sanitizePreferences(raw: unknown): SchedulePreferences {
  if (!raw || typeof raw !== 'object') return mergeWithDefaults(null);
  const r = raw as Record<string, unknown>;
  const goalsIn = (r.goals && typeof r.goals === 'object' ? r.goals : {}) as Record<string, unknown>;
  const goals = { ...DEFAULT_PREFERENCES.goals };
  GOAL_ORDER.forEach((g) => {
    // Any explicit boolean (either way) is honored; anything non-boolean falls back to the default.
    if (typeof goalsIn[g] === 'boolean') goals[g] = goalsIn[g] as boolean;
  });
  const days = (v: unknown): Day[] =>
    Array.isArray(v) ? Array.from(new Set(v.filter((d): d is Day => VALID_DAYS.includes(d as Day)))) : [];
  const mh = typeof r.maxHoursPerDay === 'number' && Number.isFinite(r.maxHoursPerDay) ? r.maxHoursPerDay : null;
  const cd =
    typeof r.preferredCampusDays === 'number' && Number.isInteger(r.preferredCampusDays)
      ? r.preferredCampusDays
      : null;
  const ps = clampMinute(r.preferredStart);
  const pe = clampMinute(r.preferredEnd);
  // A window whose start is after its end can only be corrupt input — repair by swapping.
  const range = ps != null && pe != null && ps > pe ? { preferredStart: pe, preferredEnd: ps } : { preferredStart: ps, preferredEnd: pe };
  return {
    goals,
    preferredDays: days(r.preferredDays),
    keepFreeDays: days(r.keepFreeDays),
    preferredStart: range.preferredStart,
    preferredEnd: range.preferredEnd,
    noBefore: clampMinute(r.noBefore),
    noBeforeStrict: bool(r.noBeforeStrict),
    noAfter: clampMinute(r.noAfter),
    noAfterStrict: bool(r.noAfterStrict),
    maxHoursPerDay: mh != null && mh >= 1 && mh <= 12 ? mh : null,
    preferredCampusDays: cd != null && cd >= 2 && cd <= 5 ? cd : null,
    campusDaysHard: bool(r.campusDaysHard),
    preferredDaysHard: bool(r.preferredDaysHard),
    keepFreeDaysHard: bool(r.keepFreeDaysHard),
    timeRangeHard: bool(r.timeRangeHard),
    maxHoursHard: bool(r.maxHoursHard),
  };
}

export function mergeWithDefaults(partial: Partial<SchedulePreferences> | null | undefined): SchedulePreferences {
  if (!partial) return { ...DEFAULT_PREFERENCES, goals: { ...DEFAULT_PREFERENCES.goals } };
  return {
    ...DEFAULT_PREFERENCES,
    ...partial,
    goals: { ...DEFAULT_PREFERENCES.goals, ...(partial.goals ?? {}) },
    preferredDays: Array.isArray(partial.preferredDays) ? partial.preferredDays : [],
    keepFreeDays: Array.isArray(partial.keepFreeDays) ? partial.keepFreeDays : [],
  };
}

/**
 * Reads the older preferences-only key. Kept so returning users don't lose saved preferences
 * after the move to the unified app-state store. Safe against corrupted JSON.
 */
export function loadPreferences(): SchedulePreferences {
  if (typeof window === 'undefined') return mergeWithDefaults(null);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizePreferences(JSON.parse(raw)) : mergeWithDefaults(null);
  } catch {
    return mergeWithDefaults(null);
  }
}

export function isDefaultPreferences(p: SchedulePreferences): boolean {
  return JSON.stringify(p) === JSON.stringify(DEFAULT_PREFERENCES);
}

/* ------------------------------------------------------------------ */
/* Compact form used inside the share-URL payload                      */
/* ------------------------------------------------------------------ */
