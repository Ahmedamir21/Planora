/** The main planner screen. It only places its four sections. */
import { PlannerSummary } from './planner-parts/PlannerSummary';
import { PlannerExtras } from './planner-parts/PlannerExtras';
import { PlannerWorkspace } from './planner-parts/PlannerWorkspace';
import { PlannerEvents } from './planner-parts/PlannerEvents';
import type { ReadyPlanner } from './planner-state/plannerState';

export function PlannerPage({ planner }: { planner: ReadyPlanner }) {
  return (
    <div className="space-y-3">
      <PlannerSummary planner={planner} />
      <PlannerExtras planner={planner} />
      <PlannerWorkspace planner={planner} />
      <PlannerEvents planner={planner} />
    </div>
  );
}
