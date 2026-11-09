import type { Course, Meeting } from '../types';

export type DataGap = { course: string; component: string; section: string; issue: 'Room missing' | 'Instructor unassigned' };

/** Report gaps exactly as published, without inferring whether the source withheld a room. */
export function dataCompleteness(courses: Course[]): DataGap[] {
  const gaps: DataGap[] = [];
  for (const course of courses) for (const teacher of course.instructors) {
    const meetings: Meeting[] = [...teacher.lectures, ...teacher.labs, ...teacher.tutorials];
    for (const meeting of meetings) {
      const base = { course: course.code, component: meeting.type, section: meeting.sec };
      if (!meeting.room?.trim()) gaps.push({ ...base, issue: 'Room missing' });
      if (teacher.unassigned || !teacher.name?.trim() || /^(?:instructor not assigned|tba|to be announced)$/i.test(teacher.name.trim()))
        gaps.push({ ...base, issue: 'Instructor unassigned' });
    }
  }
  return gaps;
}
