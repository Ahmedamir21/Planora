/** The whole app screen. Picks which screen to show: About, year, major, no plan or the planner. */
import { Suspense } from 'react';
import { Creators } from '../components/Creators';
import { MajorPicker } from '../components/MajorPicker';
import { AppStatus } from '../components/AppStatus';
import { AppOverlays } from './AppOverlays';
import { AppFooter } from './AppFooter';
import { PlannerPage } from './PlannerPage';
import { NoPlanPage } from './NoPlanPage';
import { YearPickerPage } from './YearPickerPage';
import { AppHeader } from './AppHeader';
import { AboutPage } from './lazyComponents';
import type { PlannerState } from './planner-state/plannerState';

export function AppPage({ planner }: { planner: PlannerState }) {
  const { showAbout, closeAbout, yearId, major, setYearId, selectMajor, yearPlan } = planner;

  return (
    <div className="min-h-screen pb-14">
      <AppStatus />
      <div className="mx-auto max-w-[1560px] px-3 py-4 sm:px-6 sm:py-6">
        <AppHeader planner={planner} />

        {showAbout ? (
          <Suspense fallback={null}><AboutPage onBack={closeAbout} /></Suspense>
        ) : !yearId ? (
          <YearPickerPage planner={planner} />
        ) : !major ? (
          <section className="panel p-4 sm:p-5">
            <h2 className="text-[13px] font-bold tracking-tight">Choose Your Major</h2>
            <p className="mb-4 mt-1 text-[12px]" style={{ color: 'var(--muted)' }}>For Year {yearId.slice(1)} · <button type="button" className="underline" onClick={() => setYearId(null)}>Change year</button></p>
            <MajorPicker selectedId={null} onSelect={selectMajor} yearId={yearId} />
          </section>
        ) : !yearPlan ? (
          <NoPlanPage planner={{ ...planner, major }} />
        ) : (
          <PlannerPage planner={{ ...planner, major, yearPlan }} />
        )}

        <AppFooter planner={planner} />

        <div className="mt-2">
          <Creators />
        </div>
      </div>

      <AppOverlays planner={planner} />
    </div>
  );
}
