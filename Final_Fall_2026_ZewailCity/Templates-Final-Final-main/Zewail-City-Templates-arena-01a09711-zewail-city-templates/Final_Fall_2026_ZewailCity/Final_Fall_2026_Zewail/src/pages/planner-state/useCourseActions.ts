/** Adding, removing and clearing courses, using a generated schedule, auto fill and moving between schedules. */
import { useCallback, useEffect } from 'react';
import { COURSE_BY_ID } from '../../data/courses';
import { findBestCombo } from '../../lib/scheduler';
import { emptyPick, uid, type Pick, type PickState } from '../../lib/picks';
import type { MeetingType } from '../../types';
import { effectiveCreditCap, wouldExceedCap } from '../../data/appState';
import type { GeneratedSchedule } from '../../lib/bestSchedule';
import { isComponentLocked, isCourseLocked } from '../../lib/assistantControls';
import type { usePlannerState } from './usePlannerState';
import type { usePlannerEffects } from './usePlannerEffects';
import type { usePlannerData } from './usePlannerData';
import type { usePlannerActions } from './usePlannerActions';
import type { Take } from './take';

type UseCourseActionsDeps = Take<ReturnType<typeof usePlannerState>, 'setCapNotice' | 'setCapShake' | 'capNoticeTimer' | 'instructorFilter' | 'setPicks' | 'setInstructorFilter' | 'setToast' | 'setPlannerLocks' | 'typeFilter' | 'courseFilter' | 'plannerLocks' | 'setComboIndex' | 'setBest' | 'setTypeFilter' | 'setCourseFilter' | 'setConfirmClearOpen'> &
  Take<ReturnType<typeof usePlannerEffects>, 'picksRef' | 'creditCapRef' | 'showToast'> &
  Take<ReturnType<typeof usePlannerData>, 'generation' | 'genKey' | 'storedCount' | 'safeIndex'> &
  Take<ReturnType<typeof usePlannerActions>, 'applyCombo'>;

export function useCourseActions(deps: UseCourseActionsDeps) {
  const { picksRef, creditCapRef, setCapNotice, setCapShake, capNoticeTimer, instructorFilter, setPicks, showToast, setInstructorFilter, setToast, setPlannerLocks, typeFilter, courseFilter, plannerLocks, setComboIndex, setBest, setTypeFilter, setCourseFilter, setConfirmClearOpen, generation, applyCombo, genKey, storedCount, safeIndex } = deps;

  const toggleCourse = useCallback((courseId: string, taking: boolean) => {
    const course = COURSE_BY_ID[courseId];
    if (taking) {
      if (wouldExceedCap(picksRef.current, courseId, creditCapRef.current)) {
        const cap = effectiveCreditCap(creditCapRef.current);

        setCapNotice(
          `This would put you over your ${cap}-credit limit. Remove a course first.`,
        );

        setCapShake((prev) => ({
          courseId,
          nonce: (prev?.nonce ?? 0) + 1,
        }));

        if (capNoticeTimer.current != null) {
          window.clearTimeout(capNoticeTimer.current);
        }

        capNoticeTimer.current = window.setTimeout(
          () => setCapNotice(null),
          4000,
        );

        return;
      }
    }

    const previousPick = picksRef.current[courseId];
    const previousInstructorFilter = instructorFilter[courseId];

    setPicks((prev) => {
      const next = { ...prev };

      if (taking) next[courseId] = prev[courseId] ?? emptyPick();
      else delete next[courseId];

      return next;
    });

    if (course) {
      if (taking) {
        showToast({ message: `${course.code} added to your schedule.` });
      } else {
        showToast({
          message: `${course.code} removed.`,
          actionLabel: 'Undo',
          onAction: () => {
            setPicks((prev) => ({ ...prev, [courseId]: previousPick ?? emptyPick() }));
            if (previousInstructorFilter != null) {
              setInstructorFilter((prev) => ({ ...prev, [courseId]: previousInstructorFilter }));
            }
            setToast(null);
          },
        });
      }
    }

    if (!taking) {
      setPlannerLocks((prev) => {
        const components = { ...prev.components };
        delete components[courseId];
        return {
          courseIds: prev.courseIds.filter((id) => id !== courseId),
          components,
        };
      });
      setInstructorFilter((prev) => {
        if (prev[courseId] == null) return prev;

        const next = { ...prev };
        delete next[courseId];

        return next;
      });
    }
  }, [showToast, instructorFilter]);

  const clearOne = useCallback((courseId: string) => {
    setPicks((prev) => ({ ...prev, [courseId]: emptyPick() }));
    setPlannerLocks((prev) => {
      const components = { ...prev.components };
      delete components[courseId];
      return { ...prev, components };
    });
    setInstructorFilter((prev) => {
      if (prev[courseId] == null) return prev;

      const next = { ...prev };
      delete next[courseId];

      return next;
    });
  }, []);

  const setInstructorPinned = useCallback((courseId: string, idx: number | null) => {
    setInstructorFilter((prev) => {
      const next = { ...prev };

      if (idx == null) delete next[courseId];
      else next[courseId] = idx;

      return next;
    });
  }, []);

  const performClearAll = useCallback(() => {
    const previousPicks = picksRef.current;
    const previousInstructorFilter = instructorFilter;
    const previousTypeFilter = typeFilter;
    const previousCourseFilter = courseFilter;
    const previousLocks = plannerLocks;
    setPicks({});
    setPlannerLocks({ courseIds: [], components: {} });
    setInstructorFilter({});
    setComboIndex(0);
    setBest(null);
    setTypeFilter('All');
    setCourseFilter('all');
    setConfirmClearOpen(false);
    showToast({
      message: 'Schedule cleared.',
      actionLabel: 'Undo',
      onAction: () => {
        setPicks(previousPicks);
        setInstructorFilter(previousInstructorFilter);
        setTypeFilter(previousTypeFilter);
        setCourseFilter(previousCourseFilter);
        setPlannerLocks(previousLocks);
        setToast(null);
      },
    });
  }, [showToast, instructorFilter, typeFilter, courseFilter, plannerLocks]);

  const requestClearAll = useCallback(() => setConfirmClearOpen(true), []);

  const useGeneratedSchedule = useCallback((schedule: GeneratedSchedule) => {
    setPicks((prev) => {
      const next: PickState = { ...prev };

      schedule.perCourse.forEach(({ course, pairing }) => {
        const current = prev[course.id] ?? emptyPick();
        const proposed: Pick = {
          Lecture: pairing.lecture ? uid(pairing.lecture) : null,
          Lab: pairing.labs[0] ? uid(pairing.labs[0]) : null,
          Tutorial: pairing.tutorials[0] ? uid(pairing.tutorials[0]) : null,
        };
        if (isCourseLocked(plannerLocks, course.id)) {
          next[course.id] = current;
          return;
        }
        (['Lecture', 'Lab', 'Tutorial'] as MeetingType[]).forEach((kind) => {
          if (isComponentLocked(plannerLocks, course.id, kind)) proposed[kind] = current[kind];
        });
        next[course.id] = proposed;
      });

      return next;
    });

    setInstructorFilter((prev) => {
      const next = { ...prev };

      schedule.perCourse.forEach(({ course, instructorIdx }) => {
        next[course.id] = instructorIdx;
      });

      return next;
    });

    setComboIndex(0);
    setBest(null);
  }, [plannerLocks]);

  const autoFill = useCallback(() => {
    if (!generation) return;

    const result = findBestCombo(generation);
    if (!result) return;

    applyCombo(result.index);

    setBest({
      key: genKey,
      index: result.index,
      metrics: result.metrics,
      complete: result.complete,
    });
  }, [generation, applyCombo, genKey]);

  const suggestBest = autoFill;

  const goPrev = useCallback(() => {
    if (storedCount === 0) return;

    applyCombo((safeIndex - 1 + storedCount) % storedCount);
  }, [storedCount, safeIndex, applyCombo]);

  const goNext = useCallback(() => {
    if (storedCount === 0) return;

    applyCombo((safeIndex + 1) % storedCount);
  }, [storedCount, safeIndex, applyCombo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;

      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext]);

  return {
    requestClearAll,
    useGeneratedSchedule,
    setInstructorPinned,
    toggleCourse,
    clearOne,
    goPrev,
    goNext,
    suggestBest,
    performClearAll,
  };
}
