import { AppPage } from './pages/AppPage';
import { usePlannerState } from './pages/planner-state/usePlannerState';
import { usePlannerEffects } from './pages/planner-state/usePlannerEffects';
import { usePlannerData } from './pages/planner-state/usePlannerData';
import { usePlannerActions } from './pages/planner-state/usePlannerActions';
import { useCourseActions } from './pages/planner-state/useCourseActions';
import { usePlannerView } from './pages/planner-state/usePlannerView';
import { useAssistantProposals } from './pages/planner-state/useAssistantProposals';
import { useAssistantContext } from './pages/planner-state/useAssistantContext';

export default function App() {
  const p1 = usePlannerState();
  const p2 = { ...p1, ...usePlannerEffects(p1) };
  const p3 = { ...p2, ...usePlannerData(p2) };
  const p4 = { ...p3, ...usePlannerActions(p3) };
  const p5 = { ...p4, ...useCourseActions(p4) };
  const p6 = { ...p5, ...usePlannerView(p5) };
  const p7 = { ...p6, ...useAssistantProposals(p6) };
  const p8 = { ...p7, ...useAssistantContext(p7) };
  return <AppPage planner={p8} />;
}
