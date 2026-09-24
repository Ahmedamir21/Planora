import type { Course } from '../types';
import schData from '../semester/sch.json';
export const SCH_ELECTIVE_COURSES: Course[] = schData as Course[];
export const SCH_ELECTIVE_COURSE_IDS = SCH_ELECTIVE_COURSES.map(course => course.id);
