import type { Course, Instructor } from '../types';
import courseData from '../semester/courses.json';
import { SCH_ELECTIVE_COURSES } from './schElectives';

/** The dataset is edited in semester/*.json; keep course IDs stable for shared links. */
export const COURSES: Course[] = [...(courseData as Course[]), ...SCH_ELECTIVE_COURSES];
export const COURSE_BY_ID: Record<string, Course> = Object.fromEntries(COURSES.map(course => [course.id, course]));
export function instructorLabel(instructor: Instructor): string {
  return instructor.unassigned ? `${instructor.name} (unassigned)` : instructor.name;
}
