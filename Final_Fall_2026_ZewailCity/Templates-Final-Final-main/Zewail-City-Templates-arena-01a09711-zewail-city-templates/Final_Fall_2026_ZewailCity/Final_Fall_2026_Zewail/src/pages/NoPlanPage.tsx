/** Shown when there is no plan published for the chosen year and major. */
import { MajorPicker } from '../components/MajorPicker';
import { YearPicker } from '../components/YearPicker';
import type { MajorPlanner } from './planner-state/plannerState';

export function NoPlanPage({ planner }: { planner: MajorPlanner }) {
  const { major, setShowMajorPicker, showMajorPicker, majorId, selectMajor, yearId, selectYear } = planner;

  return (
    <div className="space-y-3">
      <section className="panel p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="pill" style={{ color: 'var(--accent)' }}>
              Major
            </span>

            <div>
              <p className="text-[13.5px] font-bold leading-tight">{major.title}</p>

              <p
                className="text-[11.5px]"
                style={{ color: 'var(--muted)' }}
              >
                {major.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-tap"
            onClick={() => setShowMajorPicker((v) => !v)}
            aria-expanded={showMajorPicker}
          >
            {showMajorPicker ? 'Hide majors' : 'Change major'}
          </button>
        </div>

        {showMajorPicker && (
          <div className="mt-3">
            <MajorPicker
              selectedId={majorId}
              onSelect={selectMajor}
              compact
              yearId={yearId}
            />
          </div>
        )}
      </section>

      <section className="panel p-4 sm:p-5">
        <h2 className="text-[13px] font-bold tracking-tight">Choose Your Year</h2>

        <p
          className="mb-4 mt-1 text-[12px] leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          Pick the academic year you're planning — its course list appears next. You can
          still add courses from the other years afterwards.
        </p>

        <YearPicker
          major={major}
          selectedYearId={yearId}
          onSelect={selectYear}
        />
      </section>
    </div>
  );
}
