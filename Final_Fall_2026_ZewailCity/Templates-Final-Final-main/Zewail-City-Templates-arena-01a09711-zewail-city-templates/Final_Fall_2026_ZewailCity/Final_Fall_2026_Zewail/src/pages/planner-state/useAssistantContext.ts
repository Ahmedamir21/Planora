/** What the assistant is told about the planner, plus the command palette and copy summary actions. */
import { useCallback, useMemo } from 'react';
import { meetingOption, uid } from '../../lib/picks';
import { formatRange, formatDuration, to12h } from '../../lib/time';
import { COURSE_DATA_LAST_VERIFIED } from '../../data/meta';
import { TERM_SESSION_LABEL, TERM_SESSION_PAREN_LABEL } from '../../config/semester';
import type { usePlannerState } from './usePlannerState';
import type { usePlannerData } from './usePlannerData';
import type { usePlannerView } from './usePlannerView';
import type { Take } from './take';

type UseAssistantContextDeps = Take<ReturnType<typeof usePlannerState>, 'creditCap' | 'picks' | 'preferences' | 'assistantConstraints' | 'plannerLocks' | 'setCopied'> &
  Take<ReturnType<typeof usePlannerData>, 'major' | 'yearPlan' | 'effectiveCap' | 'issues' | 'overlapsFound' | 'courses' | 'takenCourses'> &
  Take<ReturnType<typeof usePlannerView>, 'totalCredits' | 'metrics' | 'detailEntries'>;

export function useAssistantContext(deps: UseAssistantContextDeps) {
  const { major, yearPlan, effectiveCap, creditCap, totalCredits, picks, metrics, preferences, assistantConstraints, plannerLocks, issues, overlapsFound, detailEntries, courses, takenCourses, setCopied } = deps;

  const assistantContext = useMemo<Record<string, unknown>>(
    () => ({
      term: TERM_SESSION_LABEL,
      dataLastVerified: COURSE_DATA_LAST_VERIFIED,
      major: major ? { id: major.id, title: major.title, subtitle: major.subtitle } : null,
      year: yearPlan ? { id: yearPlan.id, label: yearPlan.label } : null,
      creditLimit: effectiveCap,
      selectedCreditCap: creditCap,
      generalMaximumCredits: 21,
      overLoadSelected: creditCap === 21,
      totalSelectedCredits: totalCredits,
      selectedCourseIds: Object.keys(picks),
      scheduleStats: {
        sessions: metrics.sessions,
        campusDays: metrics.days,
        gapMinutes: metrics.gapMinutes,
        earliest: metrics.earliest != null ? to12h(metrics.earliest) : null,
        latest: metrics.latest != null ? to12h(metrics.latest) : null,
      },
      preferences,
      persistentConstraints: assistantConstraints,
      locks: {
        courseIds: plannerLocks.courseIds,
        components: plannerLocks.components,
      },
      currentIssues: issues.map((issue) => ({
        course: issue.code,
        kind: issue.kind,
        text: issue.text,
      })),
      conflicts: overlapsFound.map((overlap) => ({
        first: `${overlap.a.course.code} ${overlap.a.meeting.type} Sec ${overlap.a.meeting.sec}`,
        second: `${overlap.b.course.code} ${overlap.b.meeting.type} Sec ${overlap.b.meeting.sec}`,
        minutes: overlap.minutes,
      })),
      selectedCourses: detailEntries.map((entry) => ({
        courseId: entry.course.id,
        code: entry.course.code,
        name: entry.course.name,
        credits: entry.course.credits ?? null,
        meetings: entry.pairing.meetings.map((meeting) => ({
          type: meeting.type,
          meetingId: uid(meeting),
          section: meeting.sec,
          day: meeting.day,
          time: formatRange(meeting.start, meeting.end),
          room: meeting.room || 'Not published',
          instructor: meetingOption(entry.course, meeting)?.instructor.name ?? entry.instructor.name,
        })),
      })),
      availableCourses: courses.map((course) => ({
        courseId: course.id,
        code: course.code,
        name: course.name,
        credits: course.credits ?? null,
        noFixedSchedule: course.noFixedSchedule === true,
        sections: course.instructors.flatMap((instructor) => [
          ...instructor.lectures.map((meeting) => ({
            type: meeting.type,
            meetingId: uid(meeting),
            section: meeting.sec,
            day: meeting.day,
            time: formatRange(meeting.start, meeting.end),
            room: meeting.room || 'Not published',
            instructor: instructor.name,
          })),
          ...instructor.labs.map((meeting) => ({
            type: meeting.type,
            meetingId: uid(meeting),
            section: meeting.sec,
            day: meeting.day,
            time: formatRange(meeting.start, meeting.end),
            room: meeting.room || 'Not published',
            instructor: instructor.name,
          })),
          ...instructor.tutorials.map((meeting) => ({
            type: meeting.type,
            meetingId: uid(meeting),
            section: meeting.sec,
            day: meeting.day,
            time: formatRange(meeting.start, meeting.end),
            room: meeting.room || 'Not published',
            instructor: instructor.name,
          })),
        ]),
      })),
    }),
    [
      major,
      yearPlan,
      effectiveCap,
      totalCredits,
      metrics,
      preferences,
      assistantConstraints,
      plannerLocks,
      issues,
      overlapsFound,
      detailEntries,
      courses,
      picks,
    ],
  );

  const scrollToBestSchedule = useCallback(() => {
    document
      .getElementById('best-schedule-heading')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const focusCourseFromCommand = useCallback((courseId: string) => {
    const el = document.getElementById(`course-card-${courseId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => el?.classList.add('course-focus-flash'), 180);
    window.setTimeout(() => el?.classList.remove('course-focus-flash'), 1100);
  }, []);

  const shareFromCommand = useCallback(() => {
    const btn = document.querySelector<HTMLButtonElement>('[data-share-primary="true"]');
    btn?.click();
  }, []);

  const copySummary = useCallback(() => {
    const lines: string[] = [
      `My Planora schedule — ${TERM_SESSION_PAREN_LABEL}`,
      '--------------------------------',
    ];

    detailEntries.forEach((e) => {
      lines.push(`${e.course.code} — ${e.course.name} · ${e.course.credits == null ? 'Credits not published' : `${e.course.credits} credits`}`);
      if (!e.pairing.meetings.length) lines.push('   No fixed schedule published');

      e.pairing.meetings.forEach((m) => {
        lines.push(
          `   ${m.type} Sec ${m.sec} · ${m.day} ${formatRange(m.start, m.end)} · ${m.room || 'Room not published'} · ${meetingOption(e.course, m)?.instructor.name ?? e.instructor.name}`,
        );
      });
    });

    lines.push('--------------------------------');
    lines.push(`Total known credits: ${totalCredits}${takenCourses.some(course => course.credits == null) ? ' (excludes courses with unverified credits)' : ''}`);
    lines.push(
      `Sessions: ${metrics.sessions} · Campus days: ${metrics.days} · ${formatDuration(
        metrics.gapMinutes,
      )} idle`,
    );

    const text = lines.join('\n');

    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();

      try {
        document.execCommand('copy');
        done();
      } catch {
        /* ignore */
      }

      document.body.removeChild(ta);
    }
  }, [detailEntries, metrics, totalCredits, takenCourses]);

  return { scrollToBestSchedule, copySummary, assistantContext, focusCourseFromCommand, shareFromCommand };
}
