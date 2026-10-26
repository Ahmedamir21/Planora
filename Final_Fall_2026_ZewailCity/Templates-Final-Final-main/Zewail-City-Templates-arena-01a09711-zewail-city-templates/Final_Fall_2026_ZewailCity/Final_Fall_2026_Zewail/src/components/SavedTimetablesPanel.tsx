import { useEffect, useState } from 'react';
import type { PersistedState } from '../lib/appState';
import { SEMESTER_CONFIG } from '../config/semester';

export type TimetableSnapshot = Pick<
  PersistedState,
  'majorId' | 'yearId' | 'creditCap' | 'instructorFilter' | 'picks' |
  'requireComplete' | 'typeFilter' | 'courseFilter' | 'preferences'
>;

type SavedPlan = {
  id: string;
  name: string;
  savedAt: number;
  snapshot: TimetableSnapshot;
};

type Props = {
  snapshot: TimetableSnapshot;
  onRestore: (snapshot: TimetableSnapshot) => void;
  onClose: () => void;
};

const storageKey = `planora-saved-timetables-v1:${SEMESTER_CONFIG.key}`;

function readSavedPlans(): SavedPlan[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    const value: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is SavedPlan =>
      !!item && typeof item === 'object' &&
      typeof item.id === 'string' && typeof item.name === 'string' &&
      typeof item.savedAt === 'number' && !!item.snapshot && typeof item.snapshot === 'object'
    ).slice(0, 30);
  } catch {
    return [];
  }
}

export function SavedTimetablesPanel({ snapshot, onRestore, onClose }: Props) {
  const [plans, setPlans] = useState<SavedPlan[]>(readSavedPlans);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(plans));
    } catch {
      setNotice('Browser storage is full or unavailable. Export your important plans elsewhere before clearing browser data.');
    }
  }, [plans]);

  const saveCurrent = () => {
    if (!snapshot.majorId) {
      setNotice('Choose a major and set up a timetable before saving it.');
      return;
    }
    const cleanName = name.trim() || `Plan ${new Date().toLocaleDateString()}`;
    const entry: SavedPlan = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: cleanName.slice(0, 60),
      savedAt: Date.now(),
      snapshot: JSON.parse(JSON.stringify(snapshot)) as TimetableSnapshot,
    };
    setPlans((current) => [entry, ...current].slice(0, 30));
    setName('');
    setNotice('Timetable saved on this device.');
  };

  const removePlan = (id: string) => {
    setPlans((current) => current.filter((plan) => plan.id !== id));
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Saved timetables" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="panel max-h-[90vh] w-full max-w-[720px] overflow-y-auto rounded-b-none p-4 sm:rounded-2xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">Saved Timetables</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Save named versions of your plan and restore them whenever you need.</p>
          </div>
          <button type="button" className="btn" onClick={onClose}>Close</button>
        </div>

        <div className="panel-soft mt-4 flex flex-col gap-2 p-3 sm:flex-row">
          <label className="sr-only" htmlFor="saved-plan-name">Timetable name</label>
          <input id="saved-plan-name" className="select min-w-0 flex-1" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="Name this plan (e.g. Plan A)" onKeyDown={(event) => {
            if (event.key === 'Enter') saveCurrent();
          }} />
          <button type="button" className="btn btn-accent" onClick={saveCurrent}>Save current timetable</button>
        </div>

        {notice && <p className="mt-2 text-xs" role="status" style={{ color: 'var(--muted)' }}>{notice}</p>}

        <div className="mt-4 space-y-2">
          {plans.length === 0 ? (
            <div className="panel-soft p-5 text-center">
              <p className="text-sm font-semibold">No saved timetables yet</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Save your current setup to create Plan A, Plan B, or any name you prefer.</p>
            </div>
          ) : plans.map((plan) => (
            <article key={plan.id} className="panel-soft flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="break-words text-sm font-bold">{plan.name}</h3>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                  {plan.snapshot.majorId ?? 'No major'} · {new Date(plan.savedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-accent" onClick={() => {
                  onRestore(plan.snapshot);
                  setNotice(`Restored “${plan.name}”.`);
                  onClose();
                }}>Restore</button>
                <button type="button" className="btn" onClick={() => removePlan(plan.id)} aria-label={`Delete ${plan.name}`}>Delete</button>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--muted-2)' }}>Saved plans are stored in this browser on this device. Clearing browser site data can remove them; this is not a cloud backup.</p>
      </section>
    </div>
  );
}
