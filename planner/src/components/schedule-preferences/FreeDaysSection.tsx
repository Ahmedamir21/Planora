import { DAYS, DAY_LABEL } from '../../lib/time';
import type { SectionProps } from './types';
import { DayChip } from './DayChip';
import { HardToggle } from './HardToggle';
import { toggleDay } from './toggleDay';

export function FreeDaysSection({ draft, setDraft }: Pick<SectionProps, 'draft' | 'setDraft'>) {
  return (
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
  );
}
