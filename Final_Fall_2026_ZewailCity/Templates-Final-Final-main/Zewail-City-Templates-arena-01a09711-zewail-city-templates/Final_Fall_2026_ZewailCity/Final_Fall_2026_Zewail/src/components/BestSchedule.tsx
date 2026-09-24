import { useEffect, useMemo, useState } from 'react';
import type { Course } from '../types';
import { uid, type PickState } from '../lib/picks';
import { DAY_LABEL, formatDuration, formatRange, to12h } from '../lib/time';
import {
  generateBestSchedules,
  scheduleLabel,
  scheduleMatchesPicks,
  type BestScheduleReport,
  type GeneratedSchedule,
} from '../lib/bestSchedule';
import { withAssistantConstraints, type SchedulePreferences } from '../lib/preferences';
import type { ShareExtras } from '../lib/share';
import type { PlannerLocks } from '../lib/assistantControls';
import { SchedulePreferencesPanel } from './SchedulePreferences';
import { CompareSchedules } from './CompareSchedules';
import { ShareSchedule } from './ShareSchedule';
import { EmptyState } from './EmptyState';
import { TERM_LABEL } from '../config/semester';

interface Props {
  courses: Course[];
  majorId: string;
  picks: PickState;
  preferences: SchedulePreferences;
  /** Extras (preferences, instructor filter, browse filters) shared by every share entry point. */
  shareExtras?: ShareExtras;
  /** Lifted so the dashboard / mobile action bar can open the modal from anywhere. */
  prefsOpen: boolean;
  onPrefsOpenChange: (open: boolean) => void;
  onPreferencesChange: (next: SchedulePreferences) => void;
  onUse: (schedule: GeneratedSchedule) => void;
  locks?: PlannerLocks;
  assistantConstraints?: string[];
}

function picksFromSchedule(schedule: GeneratedSchedule): PickState {
  const out: PickState = {};
  schedule.perCourse.forEach(({ course, pairing }) => {
    out[course.id] = {
      Lecture: pairing.lecture ? uid(pairing.lecture) : null,
      Lab: pairing.labs[0] ? uid(pairing.labs[0]) : null,
      Tutorial: pairing.tutorials[0] ? uid(pairing.tutorials[0]) : null,
    };
  });
  return out;
}

export function BestSchedule({
  courses,
  majorId,
  picks,
  preferences,
  shareExtras,
  prefsOpen,
  onPrefsOpenChange,
  onPreferencesChange,
  onUse,
  locks,
  assistantConstraints = [],
}: Props) {
  const [report, setReport] = useState<BestScheduleReport | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const courseKey = courses.map((c) => c.id).join(',');
  useEffect(() => {
    setReport(null);
    setCompareIds([]);
  }, [courseKey]);

  const generate = (prefsOverride?: SchedulePreferences) => {
    setReport(generateBestSchedules(courses, withAssistantConstraints(prefsOverride ?? preferences, assistantConstraints), picks, locks));
    setCompareIds([]);
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const compareSchedules = useMemo(
    () => (report ? report.schedules.filter((s) => compareIds.includes(s.id)) : []),
    [report, compareIds],
  );
  const compareLabels = useMemo(
    () => (report ? compareSchedules.map((s) => scheduleLabel(report.schedules.indexOf(s))) : []),
    [report, compareSchedules],
  );

  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="best-schedule-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="best-schedule-heading" className="flex items-center gap-1.5 text-[13px] font-bold tracking-tight">
            <span aria-hidden>✦</span> Best Schedule
          </h2>
          <p className="mt-1 max-w-[56ch] text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            Searches every instructor and section for your ticked courses, rejects anything with a time conflict, and
            ranks what's left using your preferences.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-tap" onClick={() => onPrefsOpenChange(true)}>
            ⚙ Schedule Preferences
          </button>
          <button type="button" className="btn btn-accent btn-tap" onClick={() => generate()} disabled={courses.length === 0}>
            ✦ Generate Best Schedules
          </button>
        </div>
      </div>

      {courses.length === 0 && (
        <p className="mt-3 text-[12px] leading-relaxed" style={{ color: 'var(--muted-2)' }}>
          Tick at least one course below, then generate to see ranked, conflict-free schedules here.
        </p>
      )}

      {/* Case 1: a course genuinely publishes no schedulable sections at all. */}
      {report && report.noSections.length > 0 && (
        <div className="mt-4">
          <EmptyState
            icon="⚠️"
            tone="warn"
            title="No valid schedules found."
            message={`${report.noSections.map((b) => b.code).join(', ')} has no scheduled lecture/section combinations in the published data, so no schedule can include it. Try unticking that course or choosing a different one.`}
          />
        </div>
      )}

      {/* Case 2: sections exist, but every one of them breaks a hard constraint. */}
      {report && report.noSections.length === 0 && report.blockedByHard.length > 0 && (
        <div className="mt-4">
          <EmptyState
            icon="🔒"
            tone="warn"
            title="No valid schedules match your required constraints."
            message={`${report.blockedByHard.map((b) => b.code).join(', ')} does publish sections, but none satisfy: ${report.unsatisfiableHard.join('; ')}. Try relaxing one of your required constraints, or turn it back into a soft preference.`}
          />
        </div>
      )}

      {/* Case 3: every course has viable candidates, but they never combine without a clash. */}
      {report && report.noSections.length === 0 && report.blockedByHard.length === 0 && report.totalValid === 0 && (
        <div className="mt-4">
          <EmptyState
            icon={report.unsatisfiableHard.length > 0 ? '🔒' : '⚠️'}
            tone="warn"
            title={report.unsatisfiableHard.length > 0 ? 'No schedule matches your required constraints.' : 'No valid schedules found.'}
            message={
              report.unsatisfiableHard.length > 0
                ? `The selected courses cannot be combined while satisfying: ${report.unsatisfiableHard.join('; ')}. Relax that requirement or change a course/section.`
                : 'Each course has sections available, but they all overlap in time. Try changing your course selections or schedule preferences.'
            }
          />
        </div>
      )}

      {report && report.schedules.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[12px]" style={{ color: 'var(--muted)' }}>
            <span className="pill" style={{ color: 'var(--ok)' }}>
              {report.schedules.length} schedule{report.schedules.length === 1 ? '' : 's'} found
            </span>
            <span className="mono">
              {report.totalValid.toLocaleString()} conflict-free combination{report.totalValid === 1 ? '' : 's'} analyzed
              {report.earlyExit
                ? ' (stopped early — top results are provably optimal)'
                : report.truncated
                  ? ' (search budget reached — best found so far)'
                  : ''}
            </span>
          </div>

          {(() => {
            const warned: string[] = [];
            report.schedules.forEach((s) => {
              s.keepFreeViolations.forEach((d) => {
                const msg = `couldn't keep ${d} free`;
                if (!warned.includes(msg)) warned.push(msg);
              });
              s.maxHoursViolationDays.forEach((d) => {
                const msg = `over your daily hour limit on ${d}`;
                if (!warned.includes(msg)) warned.push(msg);
              });
            });
            if (warned.length === 0) return null;
            return (
              <p
                className="rounded-xl border px-3 py-2 text-[12px] leading-relaxed"
                style={{ borderColor: 'var(--warn-line)', background: 'var(--warn-bg)', color: 'var(--warn)' }}
              >
                These are the closest valid matches: no combination could satisfy {warned.join('; ')} while remaining
                conflict-free.
              </p>
            );
          })()}

          <div className="grid gap-3 md:grid-cols-2">
            {report.schedules.map((schedule, index) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                index={index}
                majorId={majorId}
                courses={courses}
                isActive={scheduleMatchesPicks(schedule, uid, picks)}
                isComparing={compareIds.includes(schedule.id)}
                canAddCompare={compareIds.length < 3}
                onToggleCompare={() => toggleCompare(schedule.id)}
                onUse={() => onUse(schedule)}
                extras={{
                  ...shareExtras,
                  instructorFilter: Object.fromEntries(schedule.perCourse.map((e) => [e.course.id, e.instructorIdx])),
                }}
              />
            ))}
          </div>

          {compareIds.length > 0 && (
            <div className="panel-soft flex flex-wrap items-center gap-2 p-3">
              <span className="text-[12px] font-semibold">{compareIds.length} selected for comparison</span>
              <button type="button" className="btn btn-accent btn-tap ml-auto" disabled={compareIds.length < 2} onClick={() => setCompareOpen(true)}>
                Compare
              </button>
              <button type="button" className="btn btn-tap" onClick={() => setCompareIds([])}>
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      <SchedulePreferencesPanel
        open={prefsOpen}
        onClose={() => onPrefsOpenChange(false)}
        preferences={preferences}
        onChange={onPreferencesChange}
        onGenerate={generate}
      />

      {compareOpen && compareSchedules.length >= 2 && (
        <CompareSchedules
          schedules={compareSchedules}
          labels={compareLabels}
          onClose={() => setCompareOpen(false)}
          onUse={(s: GeneratedSchedule) => {
            onUse(s);
            setCompareOpen(false);
          }}
        />
      )}
    </section>
  );
}

function ScheduleCard({
  schedule,
  index,
  majorId,
  courses,
  isActive,
  isComparing,
  canAddCompare,
  onToggleCompare,
  onUse,
  extras,
}: {
  schedule: GeneratedSchedule;
  index: number;
  majorId: string;
  courses: Course[];
  isActive: boolean;
  isComparing: boolean;
  canAddCompare: boolean;
  onToggleCompare: () => void;
  onUse: () => void;
  /** Extras forwarded to the card's Share link — preferences + the schedule's own instructor state. */
  extras?: ShareExtras;
}) {
  const label = scheduleLabel(index);
  const freeDays = 5 - schedule.metrics.days;
  const activeDays = schedule.daySpans.filter((d) => !d.free);
  const freeDayNames = schedule.daySpans.filter((d) => d.free).map((d) => d.day);
  const sharePicks = picksFromSchedule(schedule);

  return (
    <article
      className="course-card flex flex-col p-3.5"
      data-state={isActive ? 'selected' : undefined}
      aria-label={`${label}${index === 0 ? ', recommended' : ''}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-extrabold tracking-tight">{label}</h3>
          {index === 0 && (
            <span className="pill" style={{ color: 'var(--ok)', borderColor: 'color-mix(in srgb, var(--ok) 40%, var(--line))' }}>
              Recommended
            </span>
          )}
          {isActive && (
            <span className="pill" style={{ color: 'var(--accent)' }}>
              ✓ Active
            </span>
          )}
        </div>
        <span className="pill" title="How well this schedule matches your preferences">
          Score: {schedule.scorePercent}%
        </span>
      </header>

      <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
        <span className="pill">
          {schedule.perCourse.length} Course{schedule.perCourse.length === 1 ? '' : 's'} • {schedule.credits} Credits
        </span>
        <span className="pill" style={{ color: freeDays > 0 ? 'var(--ok)' : 'var(--muted)' }}>
          {freeDays} Free Day{freeDays === 1 ? '' : 's'}
        </span>
        <span className="pill">{formatDuration(schedule.metrics.gapMinutes)} Total Gaps</span>
        <span className="pill" title="Longest single day, using exact class durations">
          {formatDuration(schedule.maxDayMinutes)} Busiest Day
        </span>
        <span className="pill" style={{ color: 'var(--ok)' }}>
          No Conflicts
        </span>
        {schedule.metrics.earliest != null && schedule.metrics.latest != null && (
          <span className="pill">
            {to12h(schedule.metrics.earliest)} – {to12h(schedule.metrics.latest)}
          </span>
        )}
      </div>

      {schedule.keepFreeViolations.length > 0 && (
        <p className="mt-2 text-[11px] font-semibold" style={{ color: 'var(--warn)' }}>
          ⚠ Couldn't keep {schedule.keepFreeViolations.map((d) => DAY_LABEL[d]).join(', ')} free
        </p>
      )}
      {schedule.maxHoursViolationDays.length > 0 && (
        <p className="mt-1 text-[11px] font-semibold" style={{ color: 'var(--warn)' }}>
          ⚠ Exceeds your daily hour limit on {schedule.maxHoursViolationDays.map((d) => DAY_LABEL[d]).join(', ')}
        </p>
      )}

      <div className="mt-3 flex-1 space-y-2.5">
        {activeDays.map((span) => {
          const meetings = schedule.meetings.filter((m) => m.day === span.day);
          return (
            <div key={span.day}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--muted-2)' }}>
                {DAY_LABEL[span.day]}
              </p>
              <div className="mt-1 space-y-0.5">
                {meetings.map((m, i) => (
                  <p key={i} className="mono flex items-center justify-between gap-2 text-[11px]" style={{ color: 'var(--ink)' }}>
                    <span>{formatRange(m.start, m.end)}</span>
                    <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                      {courseCodeFor(schedule, m)}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          );
        })}
        {freeDayNames.length > 0 && (
          <p className="text-[11px]" style={{ color: 'var(--muted-2)' }}>
            Free: {freeDayNames.map((d) => DAY_LABEL[d]).join(', ')}
          </p>
        )}
      </div>

      <footer className="mt-3 flex flex-wrap gap-1.5 border-t pt-3" style={{ borderColor: 'var(--line-soft)' }}>
        <button type="button" className="btn btn-accent btn-tap flex-1" onClick={onUse}>
          Use This Schedule
        </button>
        <button
          type="button"
          className="btn btn-tap"
          onClick={onToggleCompare}
          disabled={!isComparing && !canAddCompare}
          aria-pressed={isComparing}
          style={isComparing ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
        >
          {isComparing ? '✓ Comparing' : 'Compare'}
        </button>
        <ShareSchedule
          majorId={majorId}
          courses={courses}
          picks={sharePicks}
          className="btn btn-tap"
          label="Share"
          shareTitle={`My ${label} — ${TERM_LABEL}`}
          extras={extras}
        />
      </footer>
    </article>
  );
}

function courseCodeFor(schedule: GeneratedSchedule, meeting: { sec: string; day: string; start: number; end: number; type: string }): string {
  const entry = schedule.perCourse.find((e) => e.pairing.meetings.some((m) => m.sec === meeting.sec && m.day === meeting.day && m.start === meeting.start && m.end === meeting.end && m.type === meeting.type));
  return entry?.course.code ?? '';
}
