import { to12h } from '../time';
import type { SchedulePreferences } from '../preferences';

/** True when at least one hard-constraint switch is currently enforced. */
export function hardConstraintsActive(prefs: SchedulePreferences): boolean {
  return hardConstraintLabels(prefs).length > 0;
}

/** Descriptions used when a hard constraint turns out to be impossible. */
export function hardConstraintLabels(prefs: SchedulePreferences): { key: string; label: string }[] {
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
