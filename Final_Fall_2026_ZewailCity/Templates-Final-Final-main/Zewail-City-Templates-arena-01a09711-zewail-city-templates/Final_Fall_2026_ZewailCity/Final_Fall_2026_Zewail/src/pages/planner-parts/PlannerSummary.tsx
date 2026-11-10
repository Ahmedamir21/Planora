/** The summary panel on top: credits, filters, schedule picker and quick actions. */
import { MajorPicker } from '../../components/MajorPicker';
import { YearPicker } from '../../components/YearPicker';
import { CreditLimitNote } from '../../components/CreditLimitNote';
import { ShareSchedule } from '../../components/ShareSchedule';
import type { ReadyPlanner } from '../planner-state/plannerState';

export function PlannerSummary({ planner }: { planner: ReadyPlanner }) {
  const { major, yearPlan, requireComplete, setRequireComplete, setShowMajorPicker, showMajorPicker, setShowYearPicker, showYearPicker, requestClearAll, takenCourses, majorId, courses, picks, shareExtras, totalCredits, noConflicts, selectMajor, yearId, selectYear, capNoteDismissed, chooseCreditCap, dismissCapNote } = planner;

  return (
    <>
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
                {major.subtitle} · {yearPlan.label}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label
              className="flex cursor-pointer items-center gap-1.5 text-[11.5px]"
              style={{ color: 'var(--muted)' }}
              title="Warn when a course publishes a lecture AND a lab/tutorial but only one of them has a time chosen"
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[var(--accent)]"
                checked={requireComplete}
                onChange={(e) => setRequireComplete(e.target.checked)}
              />

              <span className="hidden sm:inline">Flag incomplete groups</span>
              <span className="sm:hidden">Flag incomplete</span>
            </label>

            <button
              type="button"
              className="btn btn-tap"
              onClick={() => setShowMajorPicker((v) => !v)}
              aria-expanded={showMajorPicker}
            >
              {showMajorPicker ? 'Hide majors' : 'Change major'}
            </button>

            <button
              type="button"
              className="btn btn-tap"
              onClick={() => setShowYearPicker((v) => !v)}
              aria-expanded={showYearPicker}
            >
              {showYearPicker ? 'Hide years' : 'Change year'}
            </button>

            <button
              type="button"
              className="btn btn-tap"
              onClick={requestClearAll}
              disabled={takenCourses.length === 0}
              title="Reset every selected course and section"
            >
              Clear All
            </button>

            <ShareSchedule
              majorId={majorId!}
              courses={courses}
              picks={picks}
              disabled={takenCourses.length === 0}
              className="btn btn-accent btn-tap"
              dataSharePrimary
              extras={shareExtras}
              summary={{
                majorName: major.title,
                selectedCount: takenCourses.length,
                totalCredits,
                conflictFree: takenCourses.length > 0 && noConflicts,
              }}
            />
          </div>
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

        {showYearPicker && (
          <div className="mt-3">
            <YearPicker
              major={major}
              selectedYearId={yearId}
              onSelect={selectYear}
              compact
            />
          </div>
        )}
      </section>

      {!capNoteDismissed && (
        <CreditLimitNote
          onChoose={chooseCreditCap}
          onDismiss={dismissCapNote}
        />
      )}
    </>
  );
}
