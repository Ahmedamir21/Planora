import { check } from './shared';
import { DEFAULT_PREFERENCES, sanitizePreferences } from '../../src/lib/preferences';
import { toCompactPreferences, fromCompactPreferences } from '../../src/lib/preferences-parts/compact';
import { loadAppState, saveAppState, type PersistedState } from '../../src/data/appState';
import { SEMESTER_CONFIG } from '../../src/config/semester';
import { csai203, realPicks, prefsTweaked } from './p3-share';

// Saved state in localStorage and preference rules.
/* ================= 7. localStorage persistence + corruption tolerance ================= */
const store = new Map<string, string>();
// @ts-expect-error test shim
globalThis.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
export const saved: PersistedState = {
  semesterKey: SEMESTER_CONFIG.key,
  majorId: 'software',
  yearId: null,
  creditCap: null,
  instructorFilter: { csai203: 1 },
  picks: realPicks,
  requireComplete: true,
  typeFilter: 'All',
  courseFilter: 'all',
  preferences: prefsTweaked,
  savedAt: 1234,
};
saveAppState(saved);
const loaded = loadAppState();
check('save/load roundtrip preserves picks + instructorFilter', !!loaded && loaded.picks.csai203.Lecture === realPicks.csai203.Lecture && loaded.instructorFilter.csai203 === 1);
check('save/load preserves preferences', !!loaded && loaded.preferences.goals.earliestFinish === false && loaded.preferences.preferredEnd === 960);
check('instructor filter persists with NO picks (pills survive Clear-picks)', (() => {
  saveAppState({ ...saved, picks: {} });
  const l = loadAppState();
  return !!l && Object.keys(l.picks).length === 0 && l.instructorFilter.csai203 === 1;
})());
localStorage.setItem('zw-app-state-v2', '{broken json');
check('corrupt JSON => null, no throw', loadAppState() === null);
localStorage.setItem('zw-app-state-v2', JSON.stringify(null));
check('literal null => null', loadAppState() === null);
localStorage.setItem('zw-app-state-v2', JSON.stringify([1, 2, 3]));
check('array payload => null', loadAppState() === null);
localStorage.setItem(
  'zw-app-state-v2',
  JSON.stringify({ majorId: 42, picks: { csai203: { Lecture: 'zzz' }, ghost: 1 }, instructorFilter: { csai203: -1, ghost: 5 }, preferences: { preferredStart: 'oops', goals: 7 } }),
);
const junk = loadAppState()!;
check('junk top-level fields sanitized', junk.majorId === null && (!junk.picks.csai203 || !junk.picks.csai203.Lecture) && junk.picks.ghost === undefined && junk.instructorFilter.csai203 === undefined && junk.instructorFilter.ghost === undefined);
check('junk prefs sanitized to defaults', junk.preferences.preferredStart === DEFAULT_PREFERENCES.preferredStart && junk.preferences.goals.minimizeGaps === DEFAULT_PREFERENCES.goals.minimizeGaps);
check('bad filter enums rejected', (() => {
  localStorage.setItem('zw-app-state-v2', JSON.stringify({ majorId: 'software', picks: {}, instructorFilter: {}, preferences: DEFAULT_PREFERENCES, typeFilter: 'DROP TABLE', courseFilter: '../etc/passwd' }));
  const l = loadAppState()!;
  return l.typeFilter === 'All' && l.courseFilter === 'all';
})());
check('save never throws when storage quota blows up', (() => {
  const orig = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  try {
    saveAppState(saved);
    return true;
  } catch {
    return false;
  } finally {
    localStorage.setItem = orig;
  }
})());

/* ================= 8. preferences semantics ================= */
check('stored false goal is honored, not re-defaulted', sanitizePreferences({ goals: { minimizeGaps: false } }).goals.minimizeGaps === false);
check('garbage goal value falls back to default', sanitizePreferences({ goals: { minimizeGaps: 'yes' } }).goals.minimizeGaps === DEFAULT_PREFERENCES.goals.minimizeGaps);
check('out-of-range window rejected to safe default', (() => { const p = sanitizePreferences({ preferredStart: 99999 }); return p.preferredStart === null; })());
check('swapped window repaired (start<=end)', (() => { const p = sanitizePreferences({ preferredStart: 600, preferredEnd: 480 }); return p.preferredStart <= p.preferredEnd; })());
check('unknown days rejected from lists', sanitizePreferences({ keepFreeDays: ['Wed', 'Funday', 'Sat', 7] }).keepFreeDays.join() === 'Wed');
check('compact prefs roundtrip', (() => {
  const c = toCompactPreferences(prefsTweaked)!;
  const back = fromCompactPreferences(c);
  return back.preferredEnd === 960 && back.goals.earliestFinish === false && back.goals.minimizeGaps === prefsTweaked.goals.minimizeGaps;
})());
check('defaults compress to nothing (short URLs)', toCompactPreferences(DEFAULT_PREFERENCES) === undefined);
check('hard flags survive compaction', fromCompactPreferences(toCompactPreferences({ ...DEFAULT_PREFERENCES, timeRangeHard: true })!).timeRangeHard === true);
