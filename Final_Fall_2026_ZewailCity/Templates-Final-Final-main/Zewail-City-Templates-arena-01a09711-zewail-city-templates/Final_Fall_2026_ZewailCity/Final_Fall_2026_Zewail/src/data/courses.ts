import type { Course, Instructor } from '../types';
import courseData from '../semester/courses.json';
import { SCH_ELECTIVE_COURSES } from './schElectives';

/** The dataset is edited in semester/*.json; keep course IDs stable for shared links. */
export const COURSES: Course[] = [...(courseData as Course[]), ...SCH_ELECTIVE_COURSES];
export const COURSE_BY_ID: Record<string, Course> = Object.fromEntries(COURSES.map(course => [course.id, course]));
/** Offer verified English levels as choices without inventing unpublished course metadata. */
export const ENGLISH_LEVEL_CODES = ['ENGL 003', 'ENGL 004', 'ENGL 156', 'ENGL 157'] as const;
export const ENGLISH_LEVEL_COURSE_IDS = COURSES.filter(course =>
  ENGLISH_LEVEL_CODES.some(code => code === course.code.trim().replace(/\s+/g, ' ').toUpperCase()),
).map(course => course.id);
export function instructorLabel(instructor: Instructor): string {
  return instructor.unassigned ? `${instructor.name} (unassigned)` : instructor.name;
}
