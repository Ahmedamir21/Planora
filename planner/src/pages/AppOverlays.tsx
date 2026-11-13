/** Everything that floats above the page: mobile bar, dialogs, assistant, command palette and toasts. */
import { Suspense } from 'react';
import { COURSE_BY_ID } from '../data/courses';
import { Timetable } from '../components/Timetable';
import { EmptyState } from '../components/EmptyState';
import { Toast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { ScheduleAssistant, CommandPalette, ReportIssueDialog, FeedbackDialog, CrossYearBrowser } from './lazyComponents';
import type { PlannerState } from './planner-state/plannerState';

export function AppOverlays({ planner }: { planner: PlannerState }) {
  const { major, showAbout, takenCourses, scrollToBestSchedule, setMobileScheduleOpen, allEvents, setPrefsOpen, mobileScheduleOpen, visibleEvents, bestLabel, noConflicts, yearBadges, hoveredCourseId, removeTimetableComponent, yearPlan, assistantContext, previewAssistantProposal, applyAssistantProposal, assistantConstraints, addAssistantConstraints, removeAssistantConstraint, applyAssistantLockActions, commandOpen, setCommandOpen, courses, focusCourseFromCommand, shareFromCommand, reportTarget, picks, setReportTarget, feedbackOpen, setFeedbackOpen, toast, setToast, crossYearOpen, toggleCourse, setCrossYearOpen, capNotice, capShake, confirmClearOpen, setConfirmClearOpen, performClearAll } = planner;

  return (
    <>
      {/* Mobile quick-action bar: the primary workflow (generate → preferences → share) stays
          one tap away while scrolling the course list on small screens. */}
      {major && !showAbout && takenCourses.length > 0 && (
        <nav
          className="mobile-actionbar no-print"
          aria-label="Quick schedule actions"
        >
          <button
            type="button"
            className="btn btn-accent btn-tap flex-1"
            onClick={scrollToBestSchedule}
          >
            <Icon name="sparkles" /> Best
          </button>

          <button
            type="button"
            className="btn btn-tap flex-1"
            onClick={() => setMobileScheduleOpen(true)}
            disabled={allEvents.length === 0}
          >
            🗓 Schedule
          </button>

          <button
            type="button"
            className="btn btn-tap flex-1"
            onClick={() => setPrefsOpen(true)}
          >
            <Icon name="sliders" /> Preferences
          </button>
        </nav>
      )}

      {mobileScheduleOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Current schedule"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileScheduleOpen(false);
          }}
        >
          <div className="panel max-h-[88vh] w-full overflow-y-auto rounded-b-none rounded-t-2xl p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[14px] font-bold">Current Schedule</h2>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  Updates instantly as you change sections.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-tap px-3"
                onClick={() => setMobileScheduleOpen(false)}
                aria-label="Close current schedule"
              >
                ✕
              </button>
            </div>
            {allEvents.length === 0 ? (
              <EmptyState
                icon="🗓"
                title="No times selected yet."
                message="Choose a lecture, lab or tutorial and it will appear here."
              />
            ) : (
              <Timetable
                events={visibleEvents}
                hiddenCount={allEvents.length - visibleEvents.length}
                bestLabel={bestLabel}
                variant={noConflicts ? 'final' : 'draft'}
                yearBadges={yearBadges}
                highlightedCourseId={hoveredCourseId}
                onRemoveComponent={removeTimetableComponent}
              />
            )}
          </div>
        </div>
      )}

      {major && yearPlan && !showAbout && <Suspense fallback={null}><ScheduleAssistant
        context={assistantContext}
        onPreviewProposal={previewAssistantProposal}
        onApplyProposal={applyAssistantProposal}
        constraints={assistantConstraints}
        onAddConstraints={addAssistantConstraints}
        onRemoveConstraint={removeAssistantConstraint}
        onLockActions={applyAssistantLockActions}
      /></Suspense>}

      {commandOpen && <Suspense fallback={null}><CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        courses={courses}
        onSelectCourse={focusCourseFromCommand}
        onBestSchedule={scrollToBestSchedule}
        onPreferences={() => setPrefsOpen(true)}
        onShare={shareFromCommand}
      /></Suspense>}

      {reportTarget && (
        <Suspense fallback={null}><ReportIssueDialog
          course={reportTarget.courseId ? COURSE_BY_ID[reportTarget.courseId] : undefined}
          pick={reportTarget.courseId ? picks[reportTarget.courseId] : undefined}
          onClose={() => setReportTarget(null)}
        /></Suspense>
      )}
      {feedbackOpen && <Suspense fallback={null}><FeedbackDialog onClose={() => setFeedbackOpen(false)} /></Suspense>}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {crossYearOpen && major && yearPlan && (
        <Suspense fallback={null}><CrossYearBrowser
          major={major}
          currentYearId={yearPlan.id}
          picks={picks}
          onToggle={toggleCourse}
          onClose={() => setCrossYearOpen(false)}
          capNotice={capNotice}
          shake={capShake}
        /></Suspense>
      )}

      {confirmClearOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirm clear entire schedule"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmClearOpen(false);
          }}
        >
          <div className="panel w-full max-w-[420px] rounded-b-none p-5 sm:rounded-2xl">
            <h2 className="text-[15px] font-bold tracking-tight">
              Clear entire schedule?
            </h2>

            <p
              className="mt-2 text-[13px] leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              This will remove all selected courses, sections and instructor filters. Your saved
              schedule preferences won't be affected.
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn btn-tap"
                onClick={() => setConfirmClearOpen(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-tap"
                style={{
                  background: 'var(--warn)',
                  color: '#fff',
                  borderColor: 'transparent',
                }}
                onClick={performClearAll}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
