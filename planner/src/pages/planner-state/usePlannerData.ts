/** Works out the courses, the draft timetable, conflicts and the generated schedule list from the current picks. */
import { useEffect, useMemo, useState } from 'react';
import { COURSE_BY_ID } from '../../data/courses';
import { allYearCourseIds, sharedCourseIdsForMajor, MAJOR_BY_ID, yearBadgeOf, yearPlanOf } from '../../data/majors';
import { generateCombinations, type GenerationResult } from '../../lib/scheduler';
import { buildCoursePairings } from '../../lib/scheduler-parts/pairings';
import { draftMeetings, draftOverlaps } from '../../lib/picks';
import { pickIssues } from '../../lib/picks-parts/issues';
import type { Course } from '../../types';
import { effectiveCreditCap, saveAppState } from '../../data/appState';
import type { usePlannerState } from './usePlannerState';
import type { Take } from './take';

type UsePlannerDataDeps = Take<ReturnType<typeof usePlannerState>, 'majorId' | 'yearId' | 'picks' | 'creditCap' | 'instructorFilter' | 'requireComplete' | 'typeFilter' | 'courseFilter' | 'preferences' | 'comboIndex' | 'setComboIndex' | 'setBest'>;

export function usePlannerData(deps: UsePlannerDataDeps) {
  const { majorId, yearId, picks, creditCap, instructorFilter, requireComplete, typeFilter, courseFilter, preferences, comboIndex, setComboIndex, setBest } = deps;

  const major = majorId ? MAJOR_BY_ID[majorId] : null;
  const yearPlan = major && yearId ? yearPlanOf(major, yearId) : null;

  /**
   * Courses shown in the picker:
   * - the selected year's courses
   * - all common courses (e.g. SCH), available to every major/year
   * - courses from other years of the same major only when selected through the cross-year browser
   */
  const courses: Course[] = useMemo(() => {
    if (!major || !yearPlan) return [];

    // Current year's courses + common courses (e.g. SCH) available to every year.
    const baseIds = [...new Set([...yearPlan.courseIds, ...sharedCourseIdsForMajor(major)])];

    const base = baseIds
      .map((id) => COURSE_BY_ID[id])
      .filter((c): c is Course => !!c);

    const inBase = new Set(baseIds);

    // Extra courses from other years are shown only when selected through
    // the cross-year browser.
    const extras = allYearCourseIds(major)
      .filter((id) => !inBase.has(id) && picks[id] && COURSE_BY_ID[id])
      .map((id) => COURSE_BY_ID[id]);

    return [...base, ...extras];
  }, [major, yearPlan, picks]);

  /** "Year X" badge for every course NOT belonging to the currently selected year. */
  const yearBadges = useMemo(() => {
    if (!major || !yearPlan) return {};

    const out: Record<string, string> = {};

    courses.forEach((c) => {
      if (yearPlan.courseIds.includes(c.id)) return;

      const badge = yearBadgeOf(major, c.id);
      if (badge) out[c.id] = badge;
    });

    return out;
  }, [major, yearPlan, courses]);

  const takenCourses = useMemo(
    () => courses.filter((c) => picks[c.id]),
    [courses, picks],
  );

  /** Effective credit cap — the chosen tier, otherwise the planner's 21-credit hard ceiling. */
  const effectiveCap = effectiveCreditCap(creditCap);

  /* ---------------- Local Storage persistence (URL state always wins on load) ---------------- */

  useEffect(() => {
    saveAppState({
      majorId,
      yearId,
      creditCap,
      instructorFilter,
      picks,
      requireComplete,
      typeFilter,
      courseFilter,
      preferences,
    });
  }, [
    majorId,
    yearId,
    creditCap,
    instructorFilter,
    picks,
    requireComplete,
    typeFilter,
    courseFilter,
    preferences,
  ]);

  const draft = useMemo(
    () => draftMeetings(takenCourses, picks),
    [takenCourses, picks],
  );

  const overlapsFound = useMemo(
    () => draftOverlaps(draft),
    [draft],
  );

  const issues = useMemo(
    () => pickIssues(takenCourses, picks, requireComplete),
    [takenCourses, picks, requireComplete],
  );

  const noConflicts = overlapsFound.length === 0;

  /**
   * Engine space: every conflict-free combination across ALL instructor groups.
   * A lecture may pair with any instructor's lab/tutorial — the only pairing rule is
   * the time-overlap check (inside each course AND across the whole selection).
   */
  // Defer combination generation until after the first render. Restored schedules can
  // have a large search space; doing this synchronously in render can delay first paint.
  const [generation, setGeneration] = useState<GenerationResult | null>(null);

  useEffect(() => {
    const schedulable = takenCourses.filter((c) => !c.noFixedSchedule);
    if (schedulable.length === 0) {
      setGeneration(null);
      return;
    }

    setGeneration(null);
    const timer = window.setTimeout(() => {
      const entries = schedulable.map((course) => ({
        course,
        pairings: buildCoursePairings(course),
      }));
      setGeneration(generateCombinations(entries));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [takenCourses]);

  const count = generation?.count ?? 0;

  const storedCount = generation
    ? generation.truncated
      ? Math.floor(generation.flat.length / Math.max(1, generation.courseCount))
      : generation.count
    : 0;

  const safeIndex = storedCount > 0 ? Math.min(comboIndex, storedCount - 1) : 0;

  const genKey = useMemo(
    () => `${majorId ?? ''}|${takenCourses.map((c) => c.id).join(',')}|${requireComplete}`,
    [majorId, takenCourses, requireComplete],
  );

  useEffect(() => {
    setComboIndex(0);
    setBest(null);
  }, [genKey]);

  return {
    generation,
    genKey,
    safeIndex,
    count,
    storedCount,
    draft,
    takenCourses,
    noConflicts,
    issues,
    major,
    yearPlan,
    effectiveCap,
    overlapsFound,
    courses,
    yearBadges,
  };
}
