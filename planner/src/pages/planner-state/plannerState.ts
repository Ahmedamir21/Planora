// Everything the screens can read from the planner. Built from the return of each hook, in order.
import type { usePlannerState } from './usePlannerState';
import type { usePlannerEffects } from './usePlannerEffects';
import type { usePlannerData } from './usePlannerData';
import type { usePlannerActions } from './usePlannerActions';
import type { useCourseActions } from './useCourseActions';
import type { usePlannerView } from './usePlannerView';
import type { useAssistantProposals } from './useAssistantProposals';
import type { useAssistantContext } from './useAssistantContext';

export type PlannerState =
  ReturnType<typeof usePlannerState> &
  ReturnType<typeof usePlannerEffects> &
  ReturnType<typeof usePlannerData> &
  ReturnType<typeof usePlannerActions> &
  ReturnType<typeof useCourseActions> &
  ReturnType<typeof usePlannerView> &
  ReturnType<typeof useAssistantProposals> &
  ReturnType<typeof useAssistantContext>;

/** The planner after a major has been chosen (the screens below only show then). */
export type MajorPlanner = PlannerState & { major: NonNullable<PlannerState['major']> };

/** The planner after a major and a published year plan exist. */
export type ReadyPlanner = MajorPlanner & { yearPlan: NonNullable<PlannerState['yearPlan']> };
