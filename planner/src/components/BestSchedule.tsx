import { useEffect, useMemo, useState } from 'react';
import type { Course } from '../types';
import { uid, type PickState } from '../lib/picks';
import { generateBestSchedules, scheduleLabel, scheduleMatchesPicks, type BestScheduleReport, type GeneratedSchedule } from '../lib/bestSchedule';
import { type SchedulePreferences } from '../lib/preferences';
import { withAssistantConstraints } from '../lib/preferences-parts/compact';
import type { ShareExtras } from '../data/share';
import type { PlannerLocks } from '../lib/assistantControls';
import { SchedulePreferencesPanel } from './SchedulePreferences';
import { CompareSchedules } from './CompareSchedules';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import { ScheduleCard } from './best-schedule/ScheduleCard';

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
            <Icon name="sparkles" size="xs" /> Best Schedule
          </h2>
          <p className="mt-1 max-w-[56ch] text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            Searches every instructor and section for your ticked courses, rejects anything with a time conflict, and
            ranks what's left using your preferences.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-tap" onClick={() => onPrefsOpenChange(true)}>
            <Icon name="sliders" /> Schedule Preferences
          </button>
          <button type="button" className="btn btn-accent btn-tap" onClick={() => generate()} disabled={courses.length === 0}>
            <Icon name="sparkles" /> Generate Best Schedules
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
