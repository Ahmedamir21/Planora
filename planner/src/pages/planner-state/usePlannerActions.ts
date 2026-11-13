/** Things the student can do: change schedule, major, year and credit limit, lock courses, assistant constraints. */
import { useCallback, useMemo } from 'react';
import { COURSE_BY_ID } from '../../data/courses';
import { MAJOR_BY_ID } from '../../data/majors';
import { comboAt } from '../../lib/scheduler';
import { emptyPick, uid, type Pick, type PickState } from '../../lib/picks';
import type { Meeting, MeetingType, Pairing } from '../../types';
import { type CreditCap } from '../../data/appState';
import type { AssistantLockAction } from '../../components/schedule-assistant/types';
import { isComponentLocked, isCourseLocked, isFullyLocked, type PlannerLocks } from '../../lib/assistantControls';
import type { usePlannerState } from './usePlannerState';
import type { usePlannerEffects } from './usePlannerEffects';
import type { usePlannerData } from './usePlannerData';
import type { Take } from './take';

type UsePlannerActionsDeps = Take<ReturnType<typeof usePlannerState>, 'setPicks' | 'setComboIndex' | 'best' | 'picks' | 'setMajorId' | 'setInstructorFilter' | 'setCourseFilter' | 'setTypeFilter' | 'setBest' | 'setShowMajorPicker' | 'setShowYearPicker' | 'setCreditCap' | 'setCapNoteDismissed' | 'setCapNotice' | 'setCapShake' | 'setCrossYearOpen' | 'setPlannerLocks' | 'setAssistantConstraints' | 'majorId' | 'setYearId' | 'plannerLocks' | 'setToast'> &
  Take<ReturnType<typeof usePlannerEffects>, 'picksRef' | 'showToast'> &
  Take<ReturnType<typeof usePlannerData>, 'generation' | 'genKey' | 'safeIndex' | 'count'>;

export function usePlannerActions(deps: UsePlannerActionsDeps) {
  const { generation, setPicks, setComboIndex, best, genKey, safeIndex, count, picks, setMajorId, setInstructorFilter, setCourseFilter, setTypeFilter, setBest, setShowMajorPicker, setShowYearPicker, setCreditCap, setCapNoteDismissed, setCapNotice, setCapShake, setCrossYearOpen, setPlannerLocks, setAssistantConstraints, majorId, setYearId, picksRef, showToast, plannerLocks, setToast } = deps;

  /** Apply a generated combination back onto the radio selections. */
  const applyCombo = useCallback(
    (index: number) => {
      if (!generation) return;

      const indices = comboAt(generation, index);
      if (!indices) return;

      setPicks((prev) => {
        const next: PickState = { ...prev };

        generation.order.forEach((courseId, i) => {
          const pairing: Pairing | undefined = generation.pairingsByCourse[courseId]?.[indices[i]];
          if (!pairing) return;

          next[courseId] = {
            Lecture: pairing.lecture ? uid(pairing.lecture) : null,
            Lab: pairing.labs[0] ? uid(pairing.labs[0]) : null,
            Tutorial: pairing.tutorials[0] ? uid(pairing.tutorials[0]) : null,
          };
        });

        return next;
      });

      setComboIndex(index);
    },
    [generation],
  );

  const isCurrentComboBest = !!best && best.key === genKey && best.index === safeIndex;

  const engineInSync = useMemo(() => {
    if (!generation || count === 0) return false;

    const indices = comboAt(generation, safeIndex);
    if (!indices) return false;

    return generation.order.every((courseId, i) => {
      const pairing = generation.pairingsByCourse[courseId]?.[indices[i]];
      const pick = picks[courseId];

      if (!pairing || !pick) return false;

      return (
        (pairing.lecture ? uid(pairing.lecture) : null) === pick.Lecture &&
        (pairing.labs[0] ? uid(pairing.labs[0]) : null) === pick.Lab &&
        (pairing.tutorials[0] ? uid(pairing.tutorials[0]) : null) === pick.Tutorial
      );
    });
  }, [generation, count, safeIndex, picks]);

  /* ---------------- actions ---------------- */

  const selectMajor = useCallback((id: string) => {
    setMajorId(id);
    setPicks({});
    setInstructorFilter({});
    setCourseFilter('all');
    setTypeFilter('All');
    setComboIndex(0);
    setBest(null);
    setShowMajorPicker(false);
    setShowYearPicker(false);
    setCreditCap(null);
    setCapNoteDismissed(true);
    setCapNotice(null);
    setCapShake(null);
    setCrossYearOpen(false);
    setPlannerLocks({ courseIds: [], components: {} });
    setAssistantConstraints([]);
  }, []);

  const selectYear = useCallback((id: string) => {
    if (majorId && (!MAJOR_BY_ID[majorId]?.years.some(year => year.id === id) || (majorId === 'it' && id === 'y1'))) setMajorId(null);
    setYearId((prev) => {
      if (prev === id) return prev;

      setPicks({});
      setInstructorFilter({});
      setCourseFilter('all');
      setTypeFilter('All');
      setComboIndex(0);
      setBest(null);
      setCreditCap(null);
      setCapNoteDismissed(true);
      setCapNotice(null);
      setCapShake(null);

      return id;
    });

    setShowYearPicker(false);
    setCrossYearOpen(false);
    setPlannerLocks({ courseIds: [], components: {} });
    setAssistantConstraints([]);
  }, [majorId]);

  const chooseCreditCap = useCallback((cap: CreditCap) => {
    setCreditCap(cap);
    setCapNoteDismissed(true);
    setCapNotice(null);
  }, []);

  const dismissCapNote = useCallback(() => {
    setCapNoteDismissed(true);
  }, []);

  const reopenCapNote = useCallback(() => setCapNoteDismissed(false), []);

  const toggleCourseLock = useCallback((courseId: string) => {
    setPlannerLocks((prev) => {
      const course = COURSE_BY_ID[courseId];
      if (course && !isCourseLocked(prev, courseId) && isFullyLocked(course, picksRef.current[courseId], prev)) {
        const components = { ...prev.components };
        delete components[courseId];
        return { ...prev, components };
      }
      return {
        ...prev,
        courseIds: prev.courseIds.includes(courseId)
          ? prev.courseIds.filter((id) => id !== courseId)
          : [...prev.courseIds, courseId],
      };
    });
  }, []);

  const toggleComponentLock = useCallback((courseId: string, kind: MeetingType) => {
    setPlannerLocks((prev) => {
      const byKind = { ...(prev.components[courseId] ?? {}) };
      if (byKind[kind]) delete byKind[kind];
      else byKind[kind] = true;
      const components = { ...prev.components };
      if (Object.keys(byKind).length) components[courseId] = byKind;
      else delete components[courseId];
      return { ...prev, components };
    });
  }, []);

  const removeAssistantConstraint = useCallback((constraint: string) => {
    setAssistantConstraints((prev) => prev.filter((item) => item !== constraint));
  }, []);

  const addAssistantConstraints = useCallback((constraints: string[]) => {
    setAssistantConstraints((prev) =>
      Array.from(new Set([...prev, ...constraints.map((x) => x.trim()).filter(Boolean)])).slice(0, 8),
    );
  }, []);

  const applyAssistantLockActions = useCallback((actions: AssistantLockAction[]) => {
    setPlannerLocks((prev) => {
      let next: PlannerLocks = {
        courseIds: [...prev.courseIds],
        components: Object.fromEntries(
          Object.entries(prev.components).map(([courseId, byKind]) => [courseId, { ...byKind }]),
        ),
      };

      actions.forEach((action) => {
        if (!COURSE_BY_ID[action.courseId] || !picksRef.current[action.courseId]) return;
        if (action.action === 'lock_course') {
          if (!next.courseIds.includes(action.courseId)) next.courseIds.push(action.courseId);
          return;
        }
        if (action.action === 'unlock_course') {
          next.courseIds = next.courseIds.filter((id) => id !== action.courseId);
          return;
        }
        if (!action.meetingType) return;
        const byKind = { ...(next.components[action.courseId] ?? {}) };
        if (action.action === 'lock_component') byKind[action.meetingType] = true;
        else delete byKind[action.meetingType];
        if (Object.keys(byKind).length) next.components[action.courseId] = byKind;
        else delete next.components[action.courseId];
      });

      return next;
    });
  }, []);

  const changePick = useCallback((courseId: string, pick: Pick) => {
    setPicks((prev) => ({ ...prev, [courseId]: pick }));
  }, []);

  /** Remove one selected timetable component without unticking the course. */
  const removeTimetableComponent = useCallback((
    courseId: string,
    kind: MeetingType,
    meeting: Meeting,
  ) => {
    const course = COURSE_BY_ID[courseId];
    const currentPick = picksRef.current[courseId];
    if (!course || !currentPick || currentPick[kind] !== uid(meeting)) {
      showToast({ message: `${course?.code ?? 'Course'} ${kind.toLowerCase()} is no longer selected.` });
      return;
    }

    if (isComponentLocked(plannerLocks, courseId, kind)) {
      showToast({ message: `${course.code} ${kind.toLowerCase()} is locked. Unlock it before removing it.` });
      return;
    }

    const previousComponent = currentPick[kind];
    setPicks((prev) => {
      const pick = prev[courseId];
      if (!pick || pick[kind] !== uid(meeting)) return prev;
      return { ...prev, [courseId]: { ...pick, [kind]: null } };
    });

    showToast({
      message: `${course.code} ${kind.toLowerCase()} removed. Other components remain selected.`,
      actionLabel: 'Undo',
      onAction: () => {
        setPicks((prev) => {
          const pick = prev[courseId];
          if (!pick) return { ...prev, [courseId]: { ...emptyPick(), [kind]: previousComponent } };
          return { ...prev, [courseId]: { ...pick, [kind]: previousComponent } };
        });
        setToast(null);
      },
    });
  }, [plannerLocks, showToast]);

  return {
    applyCombo,
    isCurrentComboBest,
    selectYear,
    selectMajor,
    chooseCreditCap,
    dismissCapNote,
    reopenCapNote,
    changePick,
    toggleCourseLock,
    toggleComponentLock,
    removeTimetableComponent,
    engineInSync,
    addAssistantConstraints,
    removeAssistantConstraint,
    applyAssistantLockActions,
  };
}
