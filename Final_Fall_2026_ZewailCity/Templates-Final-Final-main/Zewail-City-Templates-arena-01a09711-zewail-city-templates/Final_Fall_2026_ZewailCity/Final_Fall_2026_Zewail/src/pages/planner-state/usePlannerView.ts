/** Numbers and lists shown on screen: course details, credits, free time, calendar events and share info. */
import { useEffect, useMemo, useRef } from 'react';
import { measureSchedule } from '../../lib/scheduler-parts/measure';
import { mergeHiddenSummaries, optionStates, summarizeHidden } from '../../lib/picks-parts/optionStates';
import type { MeetingType } from '../../types';
import { formatDuration, to12h } from '../../lib/time';
import { type ShareExtras } from '../../data/share';
import { computeFreeTime } from '../../lib/freeTime';
import { type TimetableEvent } from '../../components/Timetable';
import { type DetailEntry } from '../../components/ScheduleDetails';
import { type ToastState } from '../../components/Toast';
import type { usePlannerState } from './usePlannerState';
import type { usePlannerEffects } from './usePlannerEffects';
import type { usePlannerData } from './usePlannerData';
import type { usePlannerActions } from './usePlannerActions';
import type { Take } from './take';

type UsePlannerViewDeps = Take<ReturnType<typeof usePlannerState>, 'picks' | 'instructorFilter' | 'preferences' | 'typeFilter' | 'courseFilter' | 'best' | 'yearId' | 'requireComplete'> &
  Take<ReturnType<typeof usePlannerEffects>, 'showToast'> &
  Take<ReturnType<typeof usePlannerData>, 'draft' | 'takenCourses' | 'noConflicts' | 'issues'> &
  Take<ReturnType<typeof usePlannerActions>, 'isCurrentComboBest'>;

export function usePlannerView(deps: UsePlannerViewDeps) {
  const { draft, takenCourses, showToast, picks, instructorFilter, preferences, typeFilter, courseFilter, isCurrentComboBest, best, noConflicts, issues, yearId, requireComplete } = deps;

  /* ---------------- derived view data ---------------- */

  const detailEntries: DetailEntry[] = useMemo(
    () =>
      draft
        .map((d) => ({
          course: d.course,
          instructor: d.option.instructor,
          pairing: {
            meetings: [d.meeting],
            lecture: d.meeting.type === 'Lecture' ? d.meeting : undefined,
            labs: d.meeting.type === 'Lab' ? [d.meeting] : [],
            tutorials: d.meeting.type === 'Tutorial' ? [d.meeting] : [],
            instructors: { [d.meeting.type]: d.option.instructorIdx },
          },
        }))
        .reduce<DetailEntry[]>((acc, entry) => {
          const existing = acc.find((e) => e.course.id === entry.course.id);

          if (existing) {
            existing.pairing.meetings.push(...entry.pairing.meetings);

            if (entry.pairing.lecture) {
              existing.pairing.lecture = entry.pairing.lecture;
            }

            existing.pairing.labs.push(...entry.pairing.labs);
            existing.pairing.tutorials.push(...entry.pairing.tutorials);

            existing.pairing.instructors = {
              ...existing.pairing.instructors,
              ...entry.pairing.instructors,
            };
          } else {
            acc.push({
              course: entry.course,
              instructor: entry.instructor,
              pairing: {
                meetings: [...entry.pairing.meetings],
                lecture: entry.pairing.lecture,
                labs: entry.pairing.meetings.filter((m) => m.type === 'Lab'),
                tutorials: entry.pairing.meetings.filter((m) => m.type === 'Tutorial'),
                instructors: entry.pairing.instructors,
              },
            });
          }

          return acc;
        }, [])
        .concat(
          takenCourses
            .filter((c) => c.noFixedSchedule)
            .map((course) => ({
              course,
              instructor: course.instructors[0] ?? { name: 'Not published', unassigned: true, lectures: [], labs: [], tutorials: [] },
              pairing: { meetings: [], labs: [], tutorials: [] },
            })),
        ),
    [draft, takenCourses],
  );

  const metrics = useMemo(
    () => measureSchedule(draft.map((d) => d.meeting)),
    [draft],
  );

  const totalCredits = useMemo(
    () => takenCourses.reduce((sum, c) => sum + (c.credits ?? 0), 0),
    [takenCourses],
  );

  const previousCreditTotal = useRef<number | null>(null);

  useEffect(() => {
    if (previousCreditTotal.current === totalCredits) return;
    previousCreditTotal.current = totalCredits;

    const notices: Record<number, ToastState> = {
      13: {
        message: 'You’re at 13 credits. If your GPA is 2.00 or higher, you can register up to 18 credits.',
        tone: 'info',
      },
      17: {
        message: 'You’re at 17 credits — 1 credit away from the standard 18-credit limit.',
        tone: 'info',
      },
      18: {
        message: 'You’ve reached 18 credits. This is the standard maximum for GPA 2.00 or higher.',
        tone: 'warning',
      },
      21: {
        message: 'You’ve reached 21 credits — this is the maximum credit limit.',
        tone: 'danger',
      },
    };

    const notice = notices[totalCredits];
    if (notice) showToast(notice);
  }, [totalCredits, showToast]);

  const freeTime = useMemo(
    () => computeFreeTime(draft.map((d) => d.meeting)),
    [draft],
  );

  const hiddenSummary = useMemo(
    () =>
      mergeHiddenSummaries(
        takenCourses.flatMap((course) =>
          (['Lecture', 'Lab', 'Tutorial'] as MeetingType[]).map((kind) =>
            summarizeHidden(
              optionStates(course, kind, takenCourses, picks, {
                pinnedInstructorIdx: instructorFilter[course.id] ?? null,
                preferences,
              }),
            ),
          ),
        ),
      ),
    [takenCourses, picks, instructorFilter, preferences],
  );

  const allEvents: TimetableEvent[] = useMemo(
    () => draft.map((d) => ({ meeting: d.meeting, course: d.course })),
    [draft],
  );

  const visibleEvents = useMemo(
    () =>
      allEvents.filter(
        (e) =>
          (typeFilter === 'All' || (e.meeting.type as MeetingType) === typeFilter) &&
          (courseFilter === 'all' || e.course.id === courseFilter),
      ),
    [allEvents, typeFilter, courseFilter],
  );

  const bestLabel = isCurrentComboBest
    ? `${best!.metrics.days} campus day${best!.metrics.days === 1 ? '' : 's'} · ${formatDuration(
        best!.metrics.gapMinutes,
      )} idle · ends ${
        best!.metrics.latest != null ? to12h(best!.metrics.latest) : '—'
      }`
    : null;

  const canExport = draft.length > 0 && noConflicts;
  const ready = takenCourses.length > 0 && noConflicts && issues.length === 0;

  const shareExtras: ShareExtras = useMemo(
    () => ({
      yearId: yearId ?? undefined,
      requireComplete,
      typeFilter,
      courseFilter,
      preferences,
      instructorFilter,
    }),
    [yearId, requireComplete, typeFilter, courseFilter, preferences, instructorFilter],
  );

  return {
    metrics,
    totalCredits,
    detailEntries,
    shareExtras,
    freeTime,
    hiddenSummary,
    ready,
    allEvents,
    visibleEvents,
    bestLabel,
    canExport,
  };
}
