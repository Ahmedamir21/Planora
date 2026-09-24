import type { Day, Meeting, MeetingType } from '../types';

export const DAYS: Day[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

export const DAY_LABEL: Record<Day, string> = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
};

export const DAY_ORDER: Record<Day, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4 };

export const TYPE_ORDER: Record<MeetingType, number> = { Lecture: 0, Lab: 1, Tutorial: 2 };

/** Real interval overlap rule: startA < endB && startB < endA (same day). */
export function overlaps(a: Meeting, b: Meeting): boolean {
  return a.day === b.day && a.start < b.end && b.start < a.end;
}

function hour12(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

function hour12Short(mins: number): string {
  return hour12(mins).replace(' ', '');
}

/** "2:00–3:59 PM" or "11:00 AM–1:00 PM" */
export function formatRange(start: number, end: number): string {
  const sameMeridiem = Math.floor((start - 1) / 720) === Math.floor((end - 1) / 720);
  if (sameMeridiem) {
    return `${hour12Short(start)}–${hour12(end)}`;
  }
  return `${hour12(start)}–${hour12(end)}`;
}

/** "Sunday · 2:00–3:59 PM" */
export function formatMeeting(m: Meeting): string {
  return `${DAY_LABEL[m.day]} · ${formatRange(m.start, m.end)}`;
}

export function durationMinutes(m: Meeting): number {
  return m.end - m.start;
}

export function sortMeetings(list: Meeting[]): Meeting[] {
  return [...list].sort(
    (a, b) => DAY_ORDER[a.day] - DAY_ORDER[b.day] || a.start - b.start || TYPE_ORDER[a.type] - TYPE_ORDER[b.type],
  );
}

export function to12h(mins: number): string {
  return hour12(mins);
}

/** "1h 30m" / "45m" / "0m" — shared duration formatter used across stats, cards and comparisons. */
export function formatDuration(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m` : ''}`.trim();
}

/** "HH:MM" (24h, for <input type="time">) -> minutes since midnight. Returns null if unparsable. */
export function parseHHMM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 60 + min;
}

/** minutes since midnight -> "HH:MM" (24h, for <input type="time"> value). */
export function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Group overlapping meetings into "lanes" so the calendar can render them
 * side by side and make collisions visually obvious.
 */
export function packLanes(meetings: Meeting[]): { meeting: Meeting; lane: number; lanes: number }[] {
  const sorted = sortMeetings(meetings);
  const laneEnds: number[] = [];
  const placed = sorted.map((m) => {
    let lane = laneEnds.findIndex((end) => end <= m.start);
    if (lane === -1) {
      laneEnds.push(m.end);
      lane = laneEnds.length - 1;
    } else {
      laneEnds[lane] = m.end;
    }
    return { meeting: m, lane };
  });
  const lanes = Math.max(1, laneEnds.length);
  return placed.map((p) => ({ ...p, lanes }));
}
