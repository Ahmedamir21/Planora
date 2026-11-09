import { useEffect, useState } from 'react';
import { DEFAULT_PREFERENCES, isDefaultPreferences, type SchedulePreferences } from '../lib/preferences';
import { GoalsSection } from './schedule-preferences/GoalsSection';
import { PreferredDaysSection } from './schedule-preferences/PreferredDaysSection';
import { FreeDaysSection } from './schedule-preferences/FreeDaysSection';
import { HardToggle } from './schedule-preferences/HardToggle';
import { MaxHoursDropdown } from './schedule-preferences/MaxHoursDropdown';
import { TimeField } from './schedule-preferences/TimeField';

interface Props {
  open: boolean;
  onClose: () => void;
  preferences: SchedulePreferences;
  onChange: (next: SchedulePreferences) => void;
  onGenerate: (prefs: SchedulePreferences) => void;
}

export function SchedulePreferencesPanel({ open, onClose, preferences, onChange, onGenerate }: Props) {
  const [draft, setDraft] = useState<SchedulePreferences>(preferences);

  useEffect(() => {
    if (open) setDraft(preferences);
  }, [open, preferences]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const apply = () => {
    // Pass the just-edited draft directly instead of relying on the (not-yet-updated)
    // `preferences` prop, which would still hold the old values during this same event.
    onChange(draft);
    onClose();
    onGenerate(draft);
  };

  const applyOnly = () => {
    onChange(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Schedule preferences"
      onClick={(e) => {
        if (e.target === e.currentTarget) applyOnly();
      }}
    >
      <div className="panel max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-b-none p-4 sm:rounded-2xl sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[14.5px] font-bold tracking-tight">Schedule Preferences</h2>
            <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--muted)' }}>
              Guides how Best Schedule ranks results. Saved on this device.
            </p>
          </div>
          <button type="button" className="btn px-2.5 py-1.5 btn-tap" onClick={applyOnly} aria-label="Close preferences">
            ✕
          </button>
        </div>

        {/* Goals */}
        <GoalsSection draft={draft} setDraft={setDraft} />

        {/* Preferred days */}
        <PreferredDaysSection draft={draft} setDraft={setDraft} />

        {/* Keep free days */}
        <FreeDaysSection draft={draft} setDraft={setDraft} />

        {/* Preferred time range */}
        <section className="mt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: 'var(--muted-2)' }}>
            Preferred time range
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <TimeField
              label="Preferred start"
              value={draft.preferredStart}
              onChange={(v) => setDraft((d) => ({ ...d, preferredStart: v }))}
            />
            <TimeField
              label="Preferred end"
              value={draft.preferredEnd}
              onChange={(v) => setDraft((d) => ({ ...d, preferredEnd: v }))}
            />
          </div>
          <HardToggle
            label="Treat as a requirement"
            hint="Every class must fall inside this window."
            checked={draft.timeRangeHard}
            disabled={draft.preferredStart == null && draft.preferredEnd == null}
            onChange={(v) => setDraft((d) => ({ ...d, timeRangeHard: v }))}
          />
        </section>

        {/* Hard-ish edges */}
        <section className="mt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: 'var(--muted-2)' }}>
            Class-time limits
          </h3>
          <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <TimeField label="No classes before" value={draft.noBefore} onChange={(v) => setDraft((d) => ({ ...d, noBefore: v }))} />
              <label className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                <input
                  type="checkbox"
                  className="tap-checkbox accent-[var(--accent)]"
                  checked={draft.noBeforeStrict}
                  disabled={draft.noBefore == null}
                  onChange={(e) => setDraft((d) => ({ ...d, noBeforeStrict: e.target.checked }))}
                />
                Enforce strictly (hard limit)
              </label>
            </div>
            <div>
              <TimeField label="No classes after" value={draft.noAfter} onChange={(v) => setDraft((d) => ({ ...d, noAfter: v }))} />
              <label className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                <input
                  type="checkbox"
                  className="tap-checkbox accent-[var(--accent)]"
                  checked={draft.noAfterStrict}
                  disabled={draft.noAfter == null}
                  onChange={(e) => setDraft((d) => ({ ...d, noAfterStrict: e.target.checked }))}
                />
                Enforce strictly (hard limit)
              </label>
            </div>
          </div>
        </section>

        {/* Campus days */}
        <section className="mt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: 'var(--muted-2)' }}>
            Campus days per week
          </h3>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--muted-2)' }}>
            Choose how compact you want your week. By default this is a preference, not a requirement.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[null, 2, 3, 4, 5].map((days) => {
              const active = draft.preferredCampusDays === days;
              return (
                <button
                  key={days ?? 'any'}
                  type="button"
                  className="btn btn-tap px-3 py-1.5 text-[11.5px]"
                  aria-pressed={active}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      preferredCampusDays: days,
                      campusDaysHard: days == null ? false : d.campusDaysHard,
                    }))
                  }
                  style={
                    active
                      ? {
                          borderColor: 'var(--accent)',
                          color: 'var(--accent)',
                          background: 'color-mix(in srgb, var(--accent) 10%, var(--surface))',
                        }
                      : undefined
                  }
                >
                  {days == null ? 'Any' : `${days} days`}
                </button>
              );
            })}
          </div>
          <HardToggle
            label="Treat as a maximum"
            hint="Reject schedules that need more campus days than this."
            checked={draft.campusDaysHard}
            disabled={draft.preferredCampusDays == null}
            onChange={(v) => setDraft((d) => ({ ...d, campusDaysHard: v }))}
          />
        </section>

        {/* Max hours per day — a single press opens the choices; selecting is one click.
            The list is NOT permanently visible (the whole row of hour chips was replaced
            by this dropdown), but it is a custom button+menu, never a native <select>
            and never a drag/long-press control. */}
        <section className="mt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: 'var(--muted-2)' }}>
            Maximum class hours per day
          </h3>
          <div className="mt-2">
            <MaxHoursDropdown
              value={draft.maxHoursPerDay}
              onSelect={(v) => setDraft((d) => ({ ...d, maxHoursPerDay: v }))}
            />
          </div>
          <HardToggle
            label="Treat as a requirement"
            hint="Schedules exceeding this daily total are rejected outright."
            checked={draft.maxHoursHard}
            disabled={draft.maxHoursPerDay == null}
            onChange={(v) => setDraft((d) => ({ ...d, maxHoursHard: v }))}
          />
        </section>

        <div className="mt-5 flex flex-col gap-2 border-t pt-4 sm:flex-row" style={{ borderColor: 'var(--line-soft)' }}>
          <button
            type="button"
            className="btn btn-tap"
            onClick={() => setDraft(DEFAULT_PREFERENCES)}
            disabled={isDefaultPreferences(draft)}
          >
            Reset to default
          </button>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-tap" onClick={applyOnly}>
              Save only
            </button>
            <button type="button" className="btn btn-accent btn-tap" onClick={apply}>
              Save &amp; Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Soft vs hard switch for a preference. Unticked = soft (ranking only, always yields
 * results); ticked = hard (violating combinations are rejected, and we say so if nothing
 * survives rather than silently ignoring the request).
 */
