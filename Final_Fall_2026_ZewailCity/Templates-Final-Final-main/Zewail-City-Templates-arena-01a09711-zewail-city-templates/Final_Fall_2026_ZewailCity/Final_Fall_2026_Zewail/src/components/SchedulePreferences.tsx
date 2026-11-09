import { useEffect, useRef, useState } from 'react';
import { DAYS, DAY_LABEL, parseHHMM, toHHMM } from '../lib/time';
import {
  DEFAULT_PREFERENCES,
  GOAL_LABEL,
  GOAL_ORDER,
  isDefaultPreferences,
  type ScheduleGoal,
  type SchedulePreferences,
} from '../lib/preferences';
import type { Day } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  preferences: SchedulePreferences;
  onChange: (next: SchedulePreferences) => void;
  onGenerate: (prefs: SchedulePreferences) => void;
}

/** Short descriptions borrowed from Version B's preference sheet. */
const GOAL_HINT: Record<ScheduleGoal, string> = {
  minimizeGaps: 'Avoid long idle breaks between classes',
  maximizeFreeDays: 'Compact the week into fewer campus days',
  earliestFinish: 'Finish classes as early in the afternoon as possible',
  latestStart: 'Avoid 8:00 AM starts when possible',
};

function toggleDay(list: Day[], day: Day): Day[] {
  return list.includes(day) ? list.filter((d) => d !== day) : [...list, day];
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
        <section className="mt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: 'var(--muted-2)' }}>
            Preferred goals
          </h3>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--muted-2)' }}>
            Goals are soft — they rank schedules; they never invalidate one.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {GOAL_ORDER.map((goal) => (
              <label
                key={goal}
                className="tap-row flex items-start gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold"
                style={{ background: draft.goals[goal] ? 'var(--accent-soft, var(--surface-2))' : 'var(--surface)', border: '1px solid var(--line-soft)' }}
              >
                <input
                  type="checkbox"
                  className="tap-checkbox mt-0.5 accent-[var(--accent)]"
                  checked={draft.goals[goal]}
                  onChange={(e) => setDraft((d) => ({ ...d, goals: { ...d.goals, [goal]: e.target.checked } }))}
                />
                <span>
                  {GOAL_LABEL[goal]}
                  <span className="block text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                    {GOAL_HINT[goal]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Preferred days */}
        <section className="mt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: 'var(--muted-2)' }}>
            Preferred days
          </h3>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--muted-2)' }}>
            Leave empty for no preference.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DAYS.map((day) => (
              <DayChip
                key={day}
                label={DAY_LABEL[day]}
                active={draft.preferredDays.includes(day)}
                onClick={() => setDraft((d) => ({ ...d, preferredDays: toggleDay(d.preferredDays, day) }))}
              />
            ))}
          </div>
          <HardToggle
            label="Treat as a requirement"
            hint="Only schedules with classes exclusively on these days will be considered."
            checked={draft.preferredDaysHard}
            disabled={draft.preferredDays.length === 0}
            onChange={(v) => setDraft((d) => ({ ...d, preferredDaysHard: v }))}
          />
        </section>

        {/* Keep free days */}
        <section className="mt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: 'var(--muted-2)' }}>
            Days to keep free
          </h3>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--muted-2)' }}>
            Soft by default: strongly prioritized, and we tell you when it can't be honored.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DAYS.map((day) => (
              <DayChip
                key={day}
                label={DAY_LABEL[day]}
                active={draft.keepFreeDays.includes(day)}
                tone="warn"
                onClick={() => setDraft((d) => ({ ...d, keepFreeDays: toggleDay(d.keepFreeDays, day) }))}
              />
            ))}
          </div>
          <HardToggle
            label="Treat as a requirement"
            hint="Schedules that use any of these days will be rejected outright."
            checked={draft.keepFreeDaysHard}
            disabled={draft.keepFreeDays.length === 0}
            onChange={(v) => setDraft((d) => ({ ...d, keepFreeDaysHard: v }))}
          />
        </section>

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
function HardToggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="mt-2 flex items-start gap-2 rounded-lg px-2.5 py-2 text-[11.5px] leading-relaxed"
      style={{
        background: checked ? 'var(--accent-soft, var(--surface-2))' : 'var(--surface)',
        border: `1px solid ${checked ? 'var(--accent)' : 'var(--line-soft)'}`,
        color: disabled ? 'var(--muted-2)' : 'var(--muted)',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <input
        type="checkbox"
        className="tap-checkbox mt-0.5 accent-[var(--accent)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <strong style={{ color: disabled ? 'var(--muted-2)' : 'var(--ink)' }}>{label}</strong> — {hint}
      </span>
    </label>
  );
}

/** The existing value set — unchanged: No limit (null) plus 2…10 hours. */
const MAX_HOURS_CHOICES: number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * A single, normal press opens the hour choices in a compact menu; one normal click
 * selects and closes it. Deliberately NOT a native <select> (OS-picker feel on touch)
 * and never a slider/long-press. Styled with the project's own `.select` + `.panel-soft`.
 */
function MaxHoursDropdown({ value, onSelect }: { value: number | null; onSelect: (v: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Any press outside closes the menu — real mouse and touch via pointerdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const pick = (v: number | null) => {
    onSelect(v);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onKeyDown={(e) => {
        // Escape closes just this menu — stopPropagation keeps the settings modal open.
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="select btn-tap text-left"
        style={{ fontWeight: 600 }}
      >
        {value == null ? 'Maximum Hours Per Day: No limit' : `Maximum Hours Per Day: ${value} hours`}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Maximum hours per day"
          className="panel-soft absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto p-1"
          style={{ boxShadow: '0 12px 32px -12px rgba(0,0,0,0.35)' }}
        >
          <MaxHoursOption label="No limit" selected={value == null} onClick={() => pick(null)} />
          {MAX_HOURS_CHOICES.map((h) => (
            <MaxHoursOption key={h} label={`${h} hours`} selected={value === h} onClick={() => pick(h)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MaxHoursOption({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className="btn-tap flex w-full items-center justify-between rounded-lg px-3 text-[12.5px] font-semibold transition-colors"
      style={
        selected
          ? { color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, var(--paper))' }
          : { color: 'var(--ink)' }
      }
    >
      {label}
      {selected && (
        <span aria-hidden style={{ color: 'var(--accent)' }}>
          ✓
        </span>
      )}
    </button>
  );
}

function DayChip({ label, active, onClick, tone = 'accent' }: { label: string; active: boolean; onClick: () => void; tone?: 'accent' | 'warn' }) {
  const color = tone === 'warn' ? 'var(--warn)' : 'var(--accent)';
  const bg = tone === 'warn' ? 'var(--warn-bg)' : 'color-mix(in srgb, var(--accent) 14%, var(--paper))';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="btn-tap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
      style={{
        border: `1px solid ${active ? color : 'var(--line)'}`,
        background: active ? bg : 'var(--surface)',
        color: active ? color : 'var(--muted)',
      }}
    >
      {label.slice(0, 3)}
    </button>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <input
        type="time"
        className="select"
        value={value != null ? toHHMM(value) : ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v ? parseHHMM(v) : null);
        }}
      />
    </label>
  );
}
