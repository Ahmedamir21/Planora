import { DAYS, DAY_LABEL } from '../../lib/time';
import type { SectionProps } from './types';
import { DayChip } from './DayChip';
import { HardToggle } from './HardToggle';
import { toggleDay } from './toggleDay';

export function PreferredDaysSection({ draft, setDraft }: Pick<SectionProps, 'draft' | 'setDraft'>) {
  return (
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
  );
}
