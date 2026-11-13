// Small pure helpers used by the planner state hooks.
import { COURSE_BY_ID } from '../../data/courses';
import { allAvailableCourseIds, MAJOR_BY_ID } from '../../data/majors';
import { type PickState } from '../../lib/picks';

export function isAboutHash(): boolean {
  return typeof window !== 'undefined' && (window.location.hash ?? '').replace('#', '') === 'about';
}

export function trimPicksToMajor(picks: PickState, majorId: string | null): PickState {
  if (!majorId) return {};
  const mj = MAJOR_BY_ID[majorId];
  const allowed = new Set(mj ? allAvailableCourseIds(mj) : []);
  const out: PickState = {};
  Object.entries(picks).forEach(([courseId, pick]) => {
    if (allowed.has(courseId) && COURSE_BY_ID[courseId]) out[courseId] = pick;
  });
  return out;
}

export function trimFilterToMajor(
  filter: Record<string, number>,
  majorId: string | null,
): Record<string, number> {
  if (!majorId) return {};
  const mj = MAJOR_BY_ID[majorId];
  const allowed = new Set(mj ? allAvailableCourseIds(mj) : []);
  const out: Record<string, number> = {};
  Object.entries(filter).forEach(([courseId, idx]) => {
    const course = COURSE_BY_ID[courseId];
    if (allowed.has(courseId) && course && idx >= 0 && idx < course.instructors.length) {
      out[courseId] = idx;
    }
  });
  return out;
}
