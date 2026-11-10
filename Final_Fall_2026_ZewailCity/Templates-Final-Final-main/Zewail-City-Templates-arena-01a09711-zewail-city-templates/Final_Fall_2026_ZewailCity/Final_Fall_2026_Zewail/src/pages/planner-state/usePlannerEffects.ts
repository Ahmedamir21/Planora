/** Side jobs that run when things change: saving, toasts, report helpers, opening and closing the About page. */
import { useCallback, useEffect, useRef } from 'react';
import { COURSE_BY_ID } from '../../data/courses';
import { type ToastState } from '../../components/Toast';
import { SEMESTER_CONFIG } from '../../config/semester';
import { normalizeLocks, savePlannerLocks } from '../../lib/assistantControls';
import { isAboutHash } from './plannerHelpers';
import type { usePlannerState } from './usePlannerState';
import type { Take } from './take';

type UsePlannerEffectsDeps = Take<ReturnType<typeof usePlannerState>, 'picks' | 'creditCap' | 'plannerLocks' | 'setPlannerLocks' | 'assistantConstraints' | 'setShowAbout' | 'setToast' | 'toastTimer' | 'setReportTarget' | 'setCommandOpen' | 'commandOpen'>;

export function usePlannerEffects(deps: UsePlannerEffectsDeps) {
  const { picks, creditCap, plannerLocks, setPlannerLocks, assistantConstraints, setShowAbout, setToast, toastTimer, setReportTarget, setCommandOpen, commandOpen } = deps;

  /** Always-fresh mirrors so the stable toggleCourse callback can enforce the credit cap. */
  const picksRef = useRef(picks);
  picksRef.current = picks;

  const creditCapRef = useRef(creditCap);
  creditCapRef.current = creditCap;

  useEffect(() => {
    const normalized = normalizeLocks(plannerLocks, picks);
    if (JSON.stringify(normalized) !== JSON.stringify(plannerLocks)) {
      setPlannerLocks(normalized);
      return;
    }
    savePlannerLocks(normalized);
  }, [plannerLocks, picks]);

  useEffect(() => {
    try {
      window.localStorage.setItem(`zc-assistant-constraints-v2:${SEMESTER_CONFIG.key}`, JSON.stringify(assistantConstraints.slice(0, 8)));
    } catch {
      // Persistence is best-effort.
    }
  }, [assistantConstraints]);

  useEffect(() => {
    const onHashChange = () => setShowAbout(isAboutHash());

    window.addEventListener('hashchange', onHashChange);

    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const showToast = useCallback((next: ToastState) => {
    setToast(next);
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  const reportCourseIssue = useCallback((courseId: string) => {
    if (COURSE_BY_ID[courseId]) setReportTarget({ courseId });
  }, []);

  const reportGeneralIssue = useCallback(() => setReportTarget({}), []);

  useEffect(() => {
    const onCommandKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const editing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
        return;
      }
      if (!editing && e.key === '/' && !commandOpen) {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onCommandKey);
    return () => window.removeEventListener('keydown', onCommandKey);
  }, [commandOpen]);

  const openAbout = useCallback(() => {
    window.location.hash = 'about';
    setShowAbout(true);
  }, []);

  const closeAbout = useCallback(() => {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setShowAbout(false);
  }, []);

  return { picksRef, showToast, creditCapRef, closeAbout, openAbout, reportCourseIssue, reportGeneralIssue };
}
