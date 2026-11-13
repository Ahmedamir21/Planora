/** The main working area: the course list next to the weekly timetable. */
import { CoursePicker } from '../../components/CoursePicker';
import { Timetable } from '../../components/Timetable';
import { CombinationNav, Filters } from '../../components/Controls';
import { EmptyState } from '../../components/EmptyState';
import type { ReadyPlanner } from '../planner-state/plannerState';

export function PlannerWorkspace({ planner }: { planner: ReadyPlanner }) {
  const { courses, picks, instructorFilter, setInstructorPinned, preferences, changePick, toggleCourse, clearOne, yearBadges, setCrossYearOpen, capNotice, capShake, setHoveredCourseId, plannerLocks, toggleCourseLock, toggleComponentLock, reportCourseIssue, takenCourses, overlapsFound, generation, storedCount, count, issues, ready, safeIndex, goPrev, goNext, suggestBest, isCurrentComboBest, best, typeFilter, setTypeFilter, courseFilter, setCourseFilter, allEvents, visibleEvents, bestLabel, noConflicts, hoveredCourseId, removeTimetableComponent } = planner;

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
      <CoursePicker
        courses={courses}
        picks={picks}
        instructorFilter={instructorFilter}
        onInstructorFilter={setInstructorPinned}
        preferences={preferences}
        onChange={changePick}
        onToggle={toggleCourse}
        onClearOne={clearOne}
        yearBadges={yearBadges}
        onOpenCrossYear={() => setCrossYearOpen(true)}
        capNotice={capNotice}
        shake={capShake}
        onHoverCourse={setHoveredCourseId}
        locks={plannerLocks}
        onToggleCourseLock={toggleCourseLock}
        onToggleComponentLock={toggleComponentLock}
        onReportIssue={reportCourseIssue}
      />

      <div className="space-y-3">
        {takenCourses.length === 0 ? (
          <EmptyState
            icon="🗓"
            title="Select an instructor to view available schedule combinations."
            message="Tick at least one course on the left, then pick its lecture and lab/tutorial times. Nothing is generated until every component has a time."
          />
        ) : (
          <>
            {overlapsFound.length > 0 && (
              <div
                className="rounded-xl border px-3.5 py-3 text-[12px] leading-relaxed"
                style={{
                  borderColor: 'var(--warn-line)',
                  background:
                    'color-mix(in srgb, var(--warn-bg) 55%, var(--paper))',
                  color: 'var(--warn)',
                }}
                role="alert"
              >
                <strong>
                  {overlapsFound.length} time conflict
                  {overlapsFound.length > 1 ? 's' : ''} in your current picks.
                </strong>{' '}
                The overlapping blocks are outlined in red on the timetable. Change one
                of the times, or browse a generated combination instead.

                {generation && storedCount > 0 && (
                  <span className="mt-1 block">
                    {count.toLocaleString()} conflict-free combination
                    {count === 1 ? 's' : ''} exist
                    {count === 1 ? 's' : ''} for this selection — use the arrows below.
                  </span>
                )}
              </div>
            )}

            {issues.length > 0 && (
              <div className="panel-soft px-3.5 py-3" aria-live="polite">
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.06em]"
                  style={{ color: 'var(--muted-2)' }}
                >
                  Still to decide
                </p>

                <ul className="mt-1.5 space-y-1">
                  {issues.map((issue, i) => (
                    <li
                      key={i}
                      className="text-[12px] leading-snug"
                      style={{ color: 'var(--muted)' }}
                    >
                      • {issue.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ready && (
              <div
                className="rounded-xl border-2 px-4 py-3 text-center text-[13.5px] font-bold"
                style={{
                  borderColor: 'var(--ok)',
                  background:
                    'color-mix(in srgb, var(--ok) 12%, var(--paper))',
                  color: 'var(--ok)',
                }}
                role="status"
              >
                ✓ Ready to register — this selection has no time conflicts.
              </div>
            )}

            {ready && count > 0 && (
              <CombinationNav
                index={safeIndex}
                count={count}
                onPrev={goPrev}
                onNext={goNext}
                onSuggest={suggestBest}
                isBest={isCurrentComboBest}
                bestIsComplete={best?.complete ?? true}
              />
            )}

            <Filters
              typeFilter={typeFilter}
              onTypeFilter={setTypeFilter}
              courseFilter={courseFilter}
              onCourseFilter={setCourseFilter}
              courses={takenCourses}
            />

            {allEvents.length === 0 ? (
              <EmptyState
                icon="🗓"
                title="Select an instructor to view available schedule combinations."
                message="Pick at least one lecture or lab/tutorial time from the cards on the left and it will appear here instantly."
              />
            ) : (
              <div className="xl:sticky xl:top-3 xl:z-20">
                <Timetable
                  events={visibleEvents}
                  hiddenCount={allEvents.length - visibleEvents.length}
                  bestLabel={bestLabel}
                  variant={noConflicts ? 'final' : 'draft'}
                  yearBadges={yearBadges}
                  highlightedCourseId={hoveredCourseId}
                  onRemoveComponent={removeTimetableComponent}
                />
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}
