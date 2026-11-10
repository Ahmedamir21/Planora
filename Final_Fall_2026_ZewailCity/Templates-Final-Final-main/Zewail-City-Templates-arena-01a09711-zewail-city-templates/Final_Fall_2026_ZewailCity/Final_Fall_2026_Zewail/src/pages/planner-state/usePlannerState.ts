/** All the values the planner remembers (year, major, picks, filters, preferences, open dialogs). */
import { useEffect, useRef, useState } from 'react';
import { MAJOR_BY_ID } from '../../data/majors';
import { type PickState } from '../../lib/picks';
import type { ComboMetrics } from '../../types';
import { readScheduleFromLocation } from '../../data/share';
import { loadPreferences, type SchedulePreferences } from '../../lib/preferences';
import { loadAppState, type CreditCap } from '../../data/appState';
import { useTheme } from '../../components/ThemeToggle';
import { type TypeFilter } from '../../components/Controls';
import { type ToastState } from '../../components/Toast';
import { DOCUMENT_DESCRIPTION, DOCUMENT_TITLE, LEGACY_UNTAGGED_SEMESTER_KEY, SEMESTER_CONFIG } from '../../config/semester';
import { loadPlannerLocks, type PlannerLocks } from '../../lib/assistantControls';
import { trimPicksToMajor, trimFilterToMajor, isAboutHash } from './plannerHelpers';

export function usePlannerState() {

  useEffect(() => {
    document.title = DOCUMENT_TITLE;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = DOCUMENT_DESCRIPTION;
  }, []);

  const [theme, setTheme] = useTheme();

  // Both sources are read exactly once. URL state always wins over Local Storage, so opening
  // a shared link never gets clobbered by a stale saved schedule.
  const [sharedOnLoad] = useState(() => readScheduleFromLocation());
  const [savedOnLoad] = useState(() => (sharedOnLoad ? null : loadAppState()));

  const urlState = sharedOnLoad;
  const savedState = savedOnLoad;

  const [majorId, setMajorId] = useState<string | null>(() => {
    if (urlState && MAJOR_BY_ID[urlState.majorId]) return urlState.majorId;
    if (savedState?.majorId && MAJOR_BY_ID[savedState.majorId]) return savedState.majorId;
    return null;
  });

  /**
   * Selected year within the major. `null` means "not chosen yet" (the Year Picker step is
   * showing). Old saved state and old (v3) share links carry no year — they gracefully
   * default to the major's first year ('y1') instead of crashing or emptying the list.
   */
  const [yearId, setYearId] = useState<string | null>(() => {
    if (urlState && MAJOR_BY_ID[urlState.majorId]) return MAJOR_BY_ID[urlState.majorId].years.some(y => y.id === urlState.yearId) ? urlState.yearId! : MAJOR_BY_ID[urlState.majorId].years[0].id;
    if (savedState?.majorId && MAJOR_BY_ID[savedState.majorId]) return MAJOR_BY_ID[savedState.majorId].years.some(y => y.id === savedState.yearId) ? savedState.yearId! : MAJOR_BY_ID[savedState.majorId].years[0].id;
    return null;
  });

  /**
   * Credit-cap SETTING: 13 for GPA below 2.00, 18 for GPA 2.00+, or 21 only when
   * Over Load is selected. With no explicit choice, the planner keeps its 21-credit ceiling.
   * Nothing else is stored — no GPA value, no academic-standing label of any kind.
   */
  const [creditCap, setCreditCap] = useState<CreditCap | null>(() => savedState?.creditCap ?? null);
  const [capNoteDismissed, setCapNoteDismissed] = useState(true);

  /** Inline rejection message + per-card shake state when an addition would exceed the cap. */
  const [capNotice, setCapNotice] = useState<string | null>(null);
  const [capShake, setCapShake] = useState<{ courseId: string; nonce: number } | null>(null);
  const capNoticeTimer = useRef<number | null>(null);

  const [crossYearOpen, setCrossYearOpen] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const [picks, setPicks] = useState<PickState>(() => {
    if (urlState && MAJOR_BY_ID[urlState.majorId]) {
      return trimPicksToMajor(urlState.picks, urlState.majorId);
    }

    if (savedState?.picks) {
      return trimPicksToMajor(savedState.picks, savedState.majorId);
    }

    return {};
  });

  const [showMajorPicker, setShowMajorPicker] = useState(false);

  const [requireComplete, setRequireComplete] = useState(
    () => urlState?.requireComplete ?? savedState?.requireComplete ?? true,
  );

  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    () => (urlState?.typeFilter as TypeFilter) || (savedState?.typeFilter as TypeFilter) || 'All',
  );

  const [courseFilter, setCourseFilter] = useState<string>(
    () => urlState?.courseFilter ?? savedState?.courseFilter ?? 'all',
  );

  /**
   * Active "instructor filter" per course — a pure VIEW filter driven only by the
   * per-course pills. Picks never fix an instructor: lecture, lab and tutorial are each
   * chosen independently and may belong to different instructors. The filter is stored and
   * shared so a restored link reproduces exactly what the author was looking at.
   */
  const [instructorFilter, setInstructorFilter] = useState<Record<string, number>>(() => {
    if (urlState && MAJOR_BY_ID[urlState.majorId]) {
      return trimFilterToMajor(urlState.instructorFilter, urlState.majorId);
    }

    if (savedState?.instructorFilter) {
      return trimFilterToMajor(savedState.instructorFilter, savedState.majorId);
    }

    return {};
  });

  const [preferences, setPreferences] = useState<SchedulePreferences>(
    // URL preferences > saved app-state preferences > legacy prefs key > defaults (validated in each loader).
    () => urlState?.preferences ?? savedState?.preferences ?? loadPreferences(),
  );

  const [comboIndex, setComboIndex] = useState(0);
  const [best, setBest] = useState<{
    key: string;
    index: number;
    metrics: ComboMetrics;
    complete: boolean;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [showAbout, setShowAbout] = useState(isAboutHash);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [mobileScheduleOpen, setMobileScheduleOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [reportTarget, setReportTarget] = useState<{ courseId?: string } | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  /** Lifted so the Credits Dashboard and the mobile action bar can open the preferences modal. */
  const [prefsOpen, setPrefsOpen] = useState(false);

  const [plannerLocks, setPlannerLocks] = useState<PlannerLocks>(() => loadPlannerLocks());
  const [assistantConstraints, setAssistantConstraints] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const storageKey = `zc-assistant-constraints-v2:${SEMESTER_CONFIG.key}`;
      const legacy =
        SEMESTER_CONFIG.key === LEGACY_UNTAGGED_SEMESTER_KEY
          ? window.localStorage.getItem('zc-assistant-constraints-v1')
          : null;
      const raw = window.localStorage.getItem(storageKey) ?? legacy;
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, 8) : [];
    } catch {
      return [];
    }
  });

  return {
    picks,
    creditCap,
    plannerLocks,
    setPlannerLocks,
    assistantConstraints,
    setShowAbout,
    setToast,
    toastTimer,
    setReportTarget,
    setCommandOpen,
    commandOpen,
    majorId,
    yearId,
    instructorFilter,
    requireComplete,
    typeFilter,
    courseFilter,
    preferences,
    comboIndex,
    setComboIndex,
    setBest,
    setPicks,
    best,
    setMajorId,
    setInstructorFilter,
    setCourseFilter,
    setTypeFilter,
    setShowMajorPicker,
    setShowYearPicker,
    setCreditCap,
    setCapNoteDismissed,
    setCapNotice,
    setCapShake,
    setCrossYearOpen,
    setAssistantConstraints,
    setYearId,
    capNoticeTimer,
    setConfirmClearOpen,
    setCopied,
    theme,
    showAbout,
    setFeedbackOpen,
    setTheme,
    showMajorPicker,
    setRequireComplete,
    showYearPicker,
    capNoteDismissed,
    setPrefsOpen,
    prefsOpen,
    setPreferences,
    capNotice,
    capShake,
    setHoveredCourseId,
    hoveredCourseId,
    copied,
    setMobileScheduleOpen,
    mobileScheduleOpen,
    reportTarget,
    feedbackOpen,
    toast,
    crossYearOpen,
    confirmClearOpen,
  };
}
