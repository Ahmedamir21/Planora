import type { Course } from '../../types';
import { DAY_LABEL, formatDuration, formatRange, to12h } from '../../lib/time';
import { scheduleLabel, type GeneratedSchedule } from '../../lib/bestSchedule';
import type { ShareExtras } from '../../data/share';
import { ShareSchedule } from '../ShareSchedule';
import { TERM_LABEL } from '../../config/semester';
import { picksFromSchedule } from './picksFromSchedule';
import { courseCodeFor } from './courseCodeFor';

export function ScheduleCard({
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
