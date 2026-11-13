/** The list of class meetings and calendar export below the timetable. */
import { Suspense } from 'react';
import { downloadCalendarIcs } from '../../lib/calendar';
import { StatsBar } from '../../components/StatsBar';
import { ScheduleDetails } from '../../components/ScheduleDetails';
import { ShareSchedule } from '../../components/ShareSchedule';
import { InstallAppButton } from '../../components/InstallAppButton';
import { ShareScheduleImage } from '../lazyComponents';
import type { ReadyPlanner } from '../planner-state/plannerState';

export function PlannerEvents({ planner }: { planner: ReadyPlanner }) {
  const { allEvents, metrics, detailEntries, count, generation, yearBadges, majorId, courses, picks, takenCourses, shareExtras, major, totalCredits, noConflicts, yearPlan, draft, canExport, copySummary, copied, requestClearAll, engineInSync, safeIndex } = planner;

  return (
    <>
      {allEvents.length > 0 && (
        <div className="space-y-3">
          <StatsBar
            metrics={metrics}
            courseCount={detailEntries.length}
            comboCount={count}
            truncated={generation?.truncated ?? false}
            countCapped={generation?.countCapped ?? false}
          />

          <ScheduleDetails
            entries={detailEntries}
            yearBadges={yearBadges}
          />

          <div className="panel flex flex-wrap items-center gap-2 p-3">
            <ShareSchedule
              majorId={majorId!}
              courses={courses}
              picks={picks}
              disabled={takenCourses.length === 0}
              className="btn btn-tap"
              extras={shareExtras}
              summary={{
                majorName: major.title,
                selectedCount: takenCourses.length,
                totalCredits,
                conflictFree: takenCourses.length > 0 && noConflicts,
              }}
            />

            <Suspense fallback={null}><ShareScheduleImage
              events={allEvents}
              title={`${major.title} · ${yearPlan.label}`}
            /></Suspense>

            <button
              type="button"
              className="btn btn-tap"
              onClick={() => downloadCalendarIcs(draft)}
              disabled={!canExport}
              title="Download a weekly .ics calendar for Google Calendar, Apple Calendar or Outlook"
            >
              📅 Export Calendar (.ics)
            </button>

            <InstallAppButton />

            <button
              type="button"
              className="btn btn-tap"
              onClick={() => window.print()}
              disabled={!canExport}
            >
              Print / Save PDF
            </button>

            <button
              type="button"
              className="btn btn-tap"
              onClick={copySummary}
              disabled={!canExport}
            >
              {copied ? '✓ Copied' : 'Copy summary'}
            </button>

            <button
              type="button"
              className="btn btn-tap"
              onClick={requestClearAll}
              title="Reset every selected course and section"
            >
              Clear All
            </button>

            {engineInSync && (
              <span
                className="pill ml-auto"
                style={{ color: 'var(--ok)' }}
              >
                ✓ matches combination {safeIndex + 1}
              </span>
            )}
          </div>

          <p
            className="px-1 text-center text-[11px] leading-relaxed"
            style={{ color: 'var(--muted-2)' }}
          >
            Conflict rule: two meetings clash only on the same day when{' '}
            <span className="mono">startA &lt; endB</span> and{' '}
            <span className="mono">startB &lt; endA</span> — back-to-back sessions
            (2:00–2:59 then 3:00–3:59) are allowed, while 2:00–3:59 and 3:00–4:59
            clash. Non-credit tutorials and labs still count. Use ← / → to browse.
          </p>
        </div>
      )}
    </>
  );
}
