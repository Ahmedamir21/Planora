
import type { Major, YearPlan } from '../types';
import { SCH_ELECTIVE_COURSE_IDS } from './schElectives';
import { ENGLISH_LEVEL_COURSE_IDS } from './courses';

export const YEAR_IDS = ['y1', 'y2', 'y3', 'y4'] as const;

/**
 * Shared courses available to every major and every year.
 * SCH electives are not duplicated inside individual year plans.
 */
export const COMMON_COURSE_IDS: string[] = [
  ...SCH_ELECTIVE_COURSE_IDS,
  ...ENGLISH_LEVEL_COURSE_IDS,
];

import majorData from '../semester/majors.json';
export const MAJORS: Major[] = majorData as Major[];

export const MAJOR_BY_ID: Record<string, Major> = Object.fromEntries(
  MAJORS.map((mj) => [mj.id, mj]),
);

export function yearPlanOf(
  major: Major,
  yearId: string | null | undefined,
): YearPlan {
  return major.years.find((y) => y.id === yearId) ?? major.years[0];
}

export function allYearCourseIds(major: Major): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  major.years.forEach((y) =>
    y.courseIds.forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      out.push(id);
    }),
  );

  return out;
}

export function allAvailableCourseIds(major: Major, availableEnglishIds: string[] = ENGLISH_LEVEL_COURSE_IDS): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  [...allYearCourseIds(major), ...sharedCourseIdsForMajor(major, availableEnglishIds)].forEach((id) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });

  return out;
}

/** Cyber's unpublished upper-year plans stay empty; verified English is shared with everyone. */
export function sharedCourseIdsForMajor(major: Major, availableEnglishIds: string[] = ENGLISH_LEVEL_COURSE_IDS): string[] {
  return major.id === 'cyber' ? availableEnglishIds : [...SCH_ELECTIVE_COURSE_IDS, ...availableEnglishIds];
}

export function yearBadgeOf(
  major: Major,
  courseId: string,
): string | null {
  const year = major.years.find((y) => y.courseIds.includes(courseId));
  return year ? year.label.replace(/\s*\(.*\)$/, '') : null;
}
