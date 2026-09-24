import type { DraftMeeting } from './picks';
import { SEMESTER_CONFIG, TERM_LABEL } from '../config/semester';

const DAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function ymd(date: Date): string {
  return [
    date.getFullYear().toString().padStart(4, '0'),
    (date.getMonth() + 1).toString().padStart(2, '0'),
    date.getDate().toString().padStart(2, '0'),
  ].join('');
}

function localStamp(date: Date, minuteOfDay: number): string {
  const hh = Math.floor(minuteOfDay / 60).toString().padStart(2, '0');
  const mm = (minuteOfDay % 60).toString().padStart(2, '0');
  return `${ymd(date)}T${hh}${mm}00`;
}

function utcStamp(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function firstOccurrence(day: string): Date {
  const start = parseLocalDate(SEMESTER_CONFIG.calendarStartDate);
  const target = DAY_INDEX[day];
  if (target == null) return start;
  const delta = (target - start.getDay() + 7) % 7;
  const out = new Date(start);
  out.setDate(start.getDate() + delta);
  return out;
}

function weeklyCount(first: Date): number {
  const end = parseLocalDate(SEMESTER_CONFIG.calendarEndDate);
  if (first > end) return 0;
  return Math.floor((end.getTime() - first.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export function buildCalendarIcs(meetings: DraftMeeting[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zewail City Schedule Builder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(`Zewail City ${TERM_LABEL}`)}`,
    'X-WR-TIMEZONE:Africa/Cairo',
  ];

  meetings.forEach(({ course, meeting, option }) => {
    const first = firstOccurrence(meeting.day);
    const count = weeklyCount(first);
    if (count <= 0) return;

    const instructor = option.instructor.unassigned ? 'Instructor not assigned' : option.instructor.name;
    const room = meeting.room || 'Room not published';
    const uid = [
      SEMESTER_CONFIG.key,
      course.id,
      meeting.type.toLowerCase(),
      meeting.sec,
      meeting.day.toLowerCase(),
      meeting.start,
    ].join('-');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcs(uid)}@zc-schedule-builder`,
      `DTSTAMP:${utcStamp()}`,
      `DTSTART;TZID=Africa/Cairo:${localStamp(first, meeting.start)}`,
      `DTEND;TZID=Africa/Cairo:${localStamp(first, meeting.end)}`,
      `RRULE:FREQ=WEEKLY;COUNT=${count}`,
      `SUMMARY:${escapeIcs(`${course.code} · ${meeting.type} Sec ${meeting.sec}`)}`,
      `LOCATION:${escapeIcs(room)}`,
      `DESCRIPTION:${escapeIcs(`${course.name} · ${instructor} · Verify final registration details on Self-Service.`)}`,
      'END:VEVENT',
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function downloadCalendarIcs(meetings: DraftMeeting[]): void {
  if (typeof document === 'undefined' || meetings.length === 0) return;
  const blob = new Blob([buildCalendarIcs(meetings)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zewail-city-${SEMESTER_CONFIG.term.toLowerCase()}-${SEMESTER_CONFIG.year}-schedule.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
