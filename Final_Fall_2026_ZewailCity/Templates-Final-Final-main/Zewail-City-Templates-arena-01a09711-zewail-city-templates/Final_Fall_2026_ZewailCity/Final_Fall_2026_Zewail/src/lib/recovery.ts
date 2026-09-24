import { SEMESTER_CONFIG } from '../config/semester';

const EXACT_KEYS = [
  'zw-app-state-v2',
  'zw-schedule-prefs-v1',
  'zc-planner-locks-v1',
  'zc-assistant-constraints-v1',
];

export function clearPlannerState(): void {
  if (typeof window === 'undefined') return;
  try {
    EXACT_KEYS.forEach((key) => window.localStorage.removeItem(key));
    window.localStorage.removeItem(`zc-planner-locks-v2:${SEMESTER_CONFIG.key}`);
    window.localStorage.removeItem(`zc-assistant-constraints-v2:${SEMESTER_CONFIG.key}`);
  } catch {
    // Storage may be blocked; reload still gives the app another chance to recover.
  }
}
