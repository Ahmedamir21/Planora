import type { Course, Instructor } from '../types';
import courseData from '../semester/courses.json';
import { SCH_ELECTIVE_COURSES } from './schElectives';

/** The dataset is edited in semester/*.json; keep course IDs stable for shared links. */
export const COURSES: Course[] = [...(courseData as Course[]), ...SCH_ELECTIVE_COURSES];
export const COURSE_BY_ID: Record<string, Course> = Object.fromEntries(COURSES.map(course => [course.id, course]));
/** Install the validated live catalog before the planner mounts. */
export function hydrateCatalog(courses: Course[], sch: Course[]) {
  const sameIds = (incoming: Course[], bundled: Course[]) =>
    Array.isArray(incoming) && incoming.length === bundled.length &&
    incoming.every(course => course && bundled.some(original => original.id === course.id) && typeof course.code === 'string' && Array.isArray(course.instructors));
  if (!sameIds(courses, courseData as Course[]) || !sameIds(sch, SCH_ELECTIVE_COURSES)) return false;
  const combined = [...courses, ...sch];
  if (new Set(combined.map(course => course.id)).size !== combined.length) return false;
  SCH_ELECTIVE_COURSES.splice(0, SCH_ELECTIVE_COURSES.length, ...sch);
  COURSES.splice(0, COURSES.length, ...combined);
  for (const id of Object.keys(COURSE_BY_ID)) delete COURSE_BY_ID[id];
  for (const course of combined) COURSE_BY_ID[course.id] = course;
  return true;
}
/** Offer verified English levels as choices without inventing unpublished course metadata. */
export const ENGLISH_LEVEL_CODES = ['ENGL 003', 'ENGL 004', 'ENGL 156', 'ENGL 157'] as const;
export const ENGLISH_LEVEL_COURSE_IDS = COURSES.filter(course =>
  ENGLISH_LEVEL_CODES.some(code => code === course.code.trim().replace(/\s+/g, ' ').toUpperCase()),
).map(course => course.id);
export function instructorLabel(instructor: Instructor): string {
  return instructor.unassigned ? `${instructor.name} (unassigned)` : instructor.name;
}
