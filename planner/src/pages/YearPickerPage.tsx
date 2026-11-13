/** First screen: the student chooses a year. */
import { YearPicker } from '../components/YearPicker';
import { EmptyState } from '../components/EmptyState';
import type { PlannerState } from './planner-state/plannerState';

export function YearPickerPage({ planner }: { planner: PlannerState }) {
  const { yearId, selectYear } = planner;

  return (
    <div className="space-y-3">
      <EmptyState
        icon="🎓"
        title="Choose your year to begin planning your semester."
        message="Pick your academic year first; the next step shows the majors available for that year."
      />

      <section className="panel p-4 sm:p-5">
        <h2 className="text-[13px] font-bold tracking-tight">Choose Your Year</h2>

        <p
          className="mb-4 mt-1 text-[12px] leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          You'll choose your major next. You can change either selection later.
        </p>

        <YearPicker selectedYearId={yearId} onSelect={selectYear} />
      </section>
    </div>
  );
}
