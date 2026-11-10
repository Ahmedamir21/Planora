/** Checks, previews and applies the changes the AI assistant proposes. */
import { useCallback } from 'react';
import { COURSE_BY_ID } from '../../data/courses';
import { allAvailableCourseIds } from '../../data/majors';
import { measureSchedule } from '../../lib/scheduler-parts/measure';
import { draftMeetings, draftOverlaps, emptyPick, optionsFor, type PickState } from '../../lib/picks';
import type { ComboMetrics, Course, MeetingType } from '../../types';
import { formatRange, formatDuration } from '../../lib/time';
import { wouldExceedCap } from '../../data/appState';
import type { AssistantProposal, AssistantProposalPreview } from '../../components/schedule-assistant/types';
import { isComponentLocked, isCourseLocked } from '../../lib/assistantControls';
import type { usePlannerState } from './usePlannerState';
import type { usePlannerEffects } from './usePlannerEffects';
import type { usePlannerData } from './usePlannerData';
import type { usePlannerView } from './usePlannerView';
import type { Take } from './take';

type UseAssistantProposalsDeps = Take<ReturnType<typeof usePlannerState>, 'plannerLocks' | 'setPicks' | 'setComboIndex' | 'setBest' | 'setToast'> &
  Take<ReturnType<typeof usePlannerEffects>, 'picksRef' | 'creditCapRef' | 'showToast'> &
  Take<ReturnType<typeof usePlannerData>, 'major' | 'draft'> &
  Take<ReturnType<typeof usePlannerView>, 'metrics' | 'totalCredits'>;

export function useAssistantProposals(deps: UseAssistantProposalsDeps) {
  const { major, picksRef, plannerLocks, creditCapRef, metrics, totalCredits, draft, setPicks, setComboIndex, setBest, showToast, setToast } = deps;

  const evaluateAssistantProposal = useCallback(
    (proposal: AssistantProposal):
      | { ok: true; next: PickState; nextMetrics: ComboMetrics; nextCredits: number }
      | { ok: false; message: string; conflict?: { title: string; details: string[] } } => {
      if (!major || !proposal.changes.length) {
        return { ok: false, message: 'There are no valid changes to apply.' };
      }

      const allowedCourseIds = new Set(allAvailableCourseIds(major));

      if (proposal.changes.length > 8) {
        return { ok: false, message: 'That proposal contains too many changes to validate safely at once.' };
      }

      const seenComponent = new Set<string>();
      const perCourseTypes = new Map<string, Set<string>>();
      for (const change of proposal.changes) {
        const kinds = perCourseTypes.get(change.courseId) ?? new Set<string>();
        kinds.add(change.type);
        perCourseTypes.set(change.courseId, kinds);

        if (change.type === 'set_meeting') {
          const key = `${change.courseId}:${change.meetingType}`;
          if (seenComponent.has(key)) {
            return { ok: false, message: 'That proposal tries to set the same course component more than once. Ask for another option.' };
          }
          seenComponent.add(key);
        }
      }
      for (const [, kinds] of perCourseTypes) {
        if (kinds.has('remove_course') && kinds.size > 1) {
          return { ok: false, message: 'That proposal both removes and changes the same course. Ask for another option.' };
        }
      }

      const next: PickState = Object.fromEntries(
        Object.entries(picksRef.current).map(([courseId, pick]) => [courseId, { ...pick }]),
      );

      for (const change of proposal.changes) {
        const course = COURSE_BY_ID[change.courseId];

        if (!course || !allowedCourseIds.has(change.courseId)) {
          return { ok: false, message: 'That proposal contains a course that is not available for your current major.' };
        }

        if (change.type === 'remove_course') {
          if (isCourseLocked(plannerLocks, change.courseId)) {
            return { ok: false, message: `${course.code} is locked. Unlock it before AI can remove it.` };
          }
          delete next[change.courseId];
          continue;
        }

        if (!next[change.courseId]) {
          if (wouldExceedCap(next, change.courseId, creditCapRef.current)) {
            return { ok: false, message: 'That change would exceed your selected credit limit.' };
          }
          next[change.courseId] = emptyPick();
        }

        if (change.type === 'add_course') continue;

        if (isComponentLocked(plannerLocks, change.courseId, change.meetingType)) {
          return {
            ok: false,
            message: `${course.code} ${change.meetingType} is locked. Unlock it before AI can change that section.`,
          };
        }

        const option = optionsFor(course, change.meetingType).find((item) => item.key === change.meetingId);
        if (!option) {
          return {
            ok: false,
            message: `That ${change.meetingType.toLowerCase()} section is no longer available in the planner data.`,
          };
        }

        next[change.courseId] = {
          ...next[change.courseId],
          [change.meetingType]: option.key,
        };
      }

      const nextCourses = Object.keys(next)
        .map((courseId) => COURSE_BY_ID[courseId])
        .filter((course): course is Course => Boolean(course));
      const nextDraft = draftMeetings(nextCourses, next);
      const nextOverlaps = draftOverlaps(nextDraft);

      if (nextOverlaps.length > 0) {
        const first = nextOverlaps[0];
        const start = Math.max(first.a.meeting.start, first.b.meeting.start);
        const end = Math.min(first.a.meeting.end, first.b.meeting.end);
        return {
          ok: false,
          message: `This proposal would create a conflict between ${first.a.course.code} ${first.a.meeting.type} Sec ${first.a.meeting.sec} and ${first.b.course.code} ${first.b.meeting.type} Sec ${first.b.meeting.sec}.`,
          conflict: {
            title: `${first.a.meeting.day} conflict · ${formatRange(start, end)} overlap`,
            details: [
              `${first.a.course.code} · ${first.a.meeting.type} Sec ${first.a.meeting.sec} · ${formatRange(first.a.meeting.start, first.a.meeting.end)} · ${first.a.meeting.room || 'Room not published'}`,
              `${first.b.course.code} · ${first.b.meeting.type} Sec ${first.b.meeting.sec} · ${formatRange(first.b.meeting.start, first.b.meeting.end)} · ${first.b.meeting.room || 'Room not published'}`,
            ],
          },
        };
      }

      return {
        ok: true,
        next,
        nextMetrics: measureSchedule(nextDraft.map((item) => item.meeting)),
        nextCredits: nextCourses.reduce((sum, course) => sum + (course.credits ?? 0), 0),
      };
    },
    [major, plannerLocks],
  );

  const previewAssistantProposal = useCallback(
    (proposal: AssistantProposal): AssistantProposalPreview => {
      const current = picksRef.current;
      const describeMeeting = (course: Course, kind: MeetingType, key: string | null | undefined) => {
        if (!key) return 'Not selected';
        const option = optionsFor(course, kind).find((item) => item.key === key);
        if (!option) return 'Section no longer available';
        const m = option.meeting;
        return `Sec ${m.sec} · ${m.day} ${formatRange(m.start, m.end)} · ${m.room || 'Room not published'} · ${option.instructor.name}`;
      };

      const changes = proposal.changes.map((change) => {
        const course = COURSE_BY_ID[change.courseId];
        const code = course?.code ?? change.courseId;
        if (!course) return { title: change.label || code, reason: change.reason };

        if (change.type === 'set_meeting') {
          return {
            title: change.label || `${code} · ${change.meetingType}`,
            before: describeMeeting(course, change.meetingType, current[change.courseId]?.[change.meetingType]),
            after: describeMeeting(course, change.meetingType, change.meetingId),
            reason: change.reason,
          };
        }
        if (change.type === 'add_course') {
          return {
            title: change.label || `Add ${code}`,
            before: current[change.courseId] ? 'Already selected' : 'Not selected',
            after: `${code} added · ${course.credits ?? 0} credits`,
            reason: change.reason,
          };
        }
        return {
          title: change.label || `Remove ${code}`,
          before: current[change.courseId] ? `${code} selected` : 'Not selected',
          after: 'Removed from planner',
          reason: change.reason,
        };
      });

      const result = evaluateAssistantProposal(proposal);
      if (!result.ok) return { ...result, changes };

      return {
        ok: true,
        changes,
        stats: {
          campusDays: `${metrics.days} → ${result.nextMetrics.days}`,
          gaps: `${formatDuration(metrics.gapMinutes)} → ${formatDuration(result.nextMetrics.gapMinutes)}`,
          credits: `${totalCredits} → ${result.nextCredits}`,
          conflicts: `${draftOverlaps(draft).length} → 0`,
        },
      };
    },
    [evaluateAssistantProposal, metrics, totalCredits, draft],
  );

  const applyAssistantProposal = useCallback(
    (proposal: AssistantProposal): { ok: boolean; message: string } => {
      const result = evaluateAssistantProposal(proposal);
      if (!result.ok) return result;

      const previousPicks = picksRef.current;
      setPicks(result.next);
      setComboIndex(0);
      setBest(null);

      showToast({
        message: 'AI schedule changes applied.',
        actionLabel: 'Undo',
        onAction: () => {
          setPicks(previousPicks);
          setComboIndex(0);
          setBest(null);
          setToast(null);
        },
      });

      return {
        ok: true,
        message: `✓ Applied ${proposal.changes.length} validated change${proposal.changes.length === 1 ? '' : 's'}. You can undo them from the notification.`,
      };
    },
    [evaluateAssistantProposal, showToast],
  );

  return { previewAssistantProposal, applyAssistantProposal };
}
