/** The credits dashboard and the cross-year browser loaders under the summary. */
import { Suspense } from 'react';
import { WINDOW_END, WINDOW_START } from '../../lib/freeTime';
import { CreditsDashboard, BestSchedule } from '../lazyComponents';
import type { ReadyPlanner } from '../planner-state/plannerState';

export function PlannerExtras({ planner }: { planner: ReadyPlanner }) {
  const { takenCourses, courses, totalCredits, freeTime, hiddenSummary, scrollToBestSchedule, setPrefsOpen, effectiveCap, reopenCapNote, major, picks, preferences, shareExtras, prefsOpen, setPreferences, useGeneratedSchedule, plannerLocks, assistantConstraints } = planner;

  return (
    <>
      <Suspense fallback={null}><CreditsDashboard
        selectedCount={takenCourses.length}
        courseCount={courses.length}
        totalCredits={totalCredits}
        freeHours={freeTime.freeHours}
        freeDays={freeTime.freeDays}
        occupiedMinutes={freeTime.occupiedMinutes}
        windowStart={WINDOW_START}
        windowEnd={WINDOW_END}
        overlapMinutes={freeTime.overlapMinutes}
        hiddenTotal={hiddenSummary.hidden}
        conflictTotal={hiddenSummary.conflicts}
        perDay={freeTime.perDay}
        onOpenBestSchedule={scrollToBestSchedule}
        onOpenPreferences={() => setPrefsOpen(true)}
        creditCap={effectiveCap}
        onChangeLimit={reopenCapNote}
      /></Suspense>
      {takenCourses.some(course => course.credits == null) && <p role="status" className="mt-2 text-xs" style={{ color: 'var(--warn)' }}>Some selected English levels have unverified credits. The number above counts known credits only; check your official credit limit before registration.</p>}

      <Suspense fallback={null}><BestSchedule
        courses={takenCourses}
        majorId={major.id}
        picks={picks}
        preferences={preferences}
        shareExtras={shareExtras}
        prefsOpen={prefsOpen}
        onPrefsOpenChange={setPrefsOpen}
        onPreferencesChange={setPreferences}
        onUse={useGeneratedSchedule}
        locks={plannerLocks}
        assistantConstraints={assistantConstraints}
      /></Suspense>
    </>
  );
}
