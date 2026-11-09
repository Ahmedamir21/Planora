import { GOAL_LABEL, GOAL_ORDER, type ScheduleGoal } from '../../lib/preferences';
import type { SectionProps } from './types';

const GOAL_HINT: Record<ScheduleGoal, string> = {
  minimizeGaps: 'Avoid long idle breaks between classes',
  maximizeFreeDays: 'Compact the week into fewer campus days',
  earliestFinish: 'Finish classes as early in the afternoon as possible',
  latestStart: 'Avoid 8:00 AM starts when possible',
};

export function GoalsSection({ draft, setDraft }: Pick<SectionProps, 'draft' | 'setDraft'>) {
  return (
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
  );
}
