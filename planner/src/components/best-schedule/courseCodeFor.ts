import { type GeneratedSchedule } from '../../lib/bestSchedule';

export function courseCodeFor(schedule: GeneratedSchedule, meeting: { sec: string; day: string; start: number; end: number; type: string }): string {
  const entry = schedule.perCourse.find((e) => e.pairing.meetings.some((m) => m.sec === meeting.sec && m.day === meeting.day && m.start === meeting.start && m.end === meeting.end && m.type === meeting.type));
  return entry?.course.code ?? '';
}
