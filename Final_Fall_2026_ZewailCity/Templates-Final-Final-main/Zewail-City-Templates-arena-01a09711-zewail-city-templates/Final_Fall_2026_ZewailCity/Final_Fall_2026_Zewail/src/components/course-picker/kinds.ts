import type { Course, MeetingType } from '../../types';

export const KIND_ORDER: MeetingType[] = ['Lecture', 'Lab', 'Tutorial'];
export const KIND_ICON: Record<MeetingType, string> = { Lecture: '📢', Lab: '🧪', Tutorial: '📝' };

export function countableKinds(course: Course): MeetingType[] {
  return KIND_ORDER.filter(
    (kind) => (kind === 'Lecture' ? course.instructors.some((i) => i.lectures.length) : kind === 'Lab' ? course.instructors.some((i) => i.labs.length) : course.instructors.some((i) => i.tutorials.length)),
  );
}
