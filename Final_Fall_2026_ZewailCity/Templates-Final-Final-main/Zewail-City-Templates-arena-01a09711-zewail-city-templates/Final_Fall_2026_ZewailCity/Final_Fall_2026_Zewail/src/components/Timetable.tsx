import { useEffect, useState } from 'react';
import type { Course, Meeting } from '../types';
import { DAYS, DAY_LABEL, formatRange, packLanes, to12h } from '../lib/time';
import { uid } from '../lib/picks';
import { SEMESTER_CONFIG, TERM_SESSION_LABEL } from '../config/semester';

export interface TimetableEvent {
  meeting: Meeting;
  course: Course;
}

const PX_PER_HOUR = 62;
const GUTTER = 54;

export function Timetable({
  events,
  hiddenCount,
  bestLabel,
  variant = 'final',
  yearBadges,
  highlightedCourseId,
}: {
  events: TimetableEvent[];
  hiddenCount: number;
  bestLabel?: string | null;
  variant?: 'final' | 'draft';
  /** "Year X" note per course id for cross-year additions — shown in the event tooltip. */
  yearBadges?: Record<string, string>;
  /** Course currently hovered/focused in the picker; other timetable events dim slightly. */
  highlightedCourseId?: string | null;
}) {
  const [selectedEvent, setSelectedEvent] = useState<TimetableEvent | null>(null);
  useEffect(() => {
    if (!selectedEvent) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedEvent(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [selectedEvent]);
  const starts = events.map((e) => e.meeting.start);
  const ends = events.map((e) => e.meeting.end);
  const firstHour = Math.floor(Math.min(8 * 60, ...(starts.length ? starts : [8 * 60])) / 60);
  const lastHour = Math.ceil(Math.max(18 * 60, ...(ends.length ? ends : [18 * 60])) / 60);
  const hours: number[] = [];
  for (let h = firstHour; h < lastHour; h++) hours.push(h);
  const height = hours.length * PX_PER_HOUR;
  const columns = `${GUTTER}px repeat(5, minmax(112px, 1fr))`;

  const byDay = DAYS.map((day) => ({
    day,
    items: packLanes(events.filter((e) => e.meeting.day === day).map((e) => e.meeting)),
  }));

  /** Identity-based overlap detection: same rule as the engine, applied to whatever is on screen. */
  const clashing = new Set<string>();
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i].meeting;
      const b = events[j].meeting;
      if (a.day === b.day && a.start < b.end && b.start < a.end) {
        clashing.add(uid(a));
        clashing.add(uid(b));
      }
    }
  }
  const overlapCount = clashing.size / 2;

  return (
    <>
    <section className="panel overflow-hidden" aria-label="Weekly timetable">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-bold tracking-tight">Weekly Timetable</h2>
          <span className="pill">{TERM_SESSION_LABEL}</span>
          {variant === 'draft' && (
            <span className="pill" style={{ color: 'var(--warn)', borderColor: 'var(--warn-line)' }}>
              draft preview
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--muted)' }}>
          {bestLabel && (
            <span
              className="pill"
              style={{ color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--line))' }}
            >
              ✦ {bestLabel}
            </span>
          )}
          {overlapCount > 0 && (
            <span className="pill" style={{ color: 'var(--warn)', borderColor: 'var(--warn-line)', background: 'var(--warn-bg)' }}>
              ⚠ {overlapCount} overlap{overlapCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="mono">
            {events.length} session{events.length === 1 ? '' : 's'} shown
            {hiddenCount > 0 ? ` · ${hiddenCount} filtered out` : ''}
          </span>
        </div>
      </div>

      <div className="scroll-hint items-center gap-1.5 border-b px-4 py-1.5 text-[10.5px] font-semibold" style={{ borderColor: 'var(--line-soft)', color: 'var(--muted-2)' }}>
        <span aria-hidden>↔</span> Swipe sideways to see all five days
      </div>

      <div className="scroll-thin overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid border-b" style={{ gridTemplateColumns: columns, borderColor: 'var(--line-soft)' }}>
            {/* Sticky time gutter keeps hours visible while swiping days on touch screens. */}
            <div className="sticky left-0 z-10" style={{ width: GUTTER, background: 'var(--paper)' }} />
            {DAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.07em]"
                style={{ color: 'var(--muted)', borderLeft: '1px solid var(--line-soft)' }}
              >
                {DAY_LABEL[day]}
              </div>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: columns }}>
            <div className="sticky left-0 z-10" style={{ width: GUTTER, height, background: 'var(--paper)' }}>
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="mono absolute right-1.5 -translate-y-1/2 text-[9.5px]"
                  style={{ top: i * PX_PER_HOUR + (i === 0 ? 8 : 0), color: 'var(--muted-2)' }}
                >
                  {to12h(h * 60)}
                </div>
              ))}
            </div>

            {byDay.map(({ day, items }) => (
              <div key={day} className="relative" style={{ height, borderLeft: '1px solid var(--line-soft)' }}>
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute inset-x-0"
                    style={{
                      top: i * PX_PER_HOUR,
                      height: PX_PER_HOUR,
                      borderTop: i === 0 ? 'none' : '1px solid var(--grid-line)',
                    }}
                  />
                ))}
                {items.map(({ meeting, lane, lanes }) => {
                  const ev = events.find((e) => e.meeting === meeting);
                  if (!ev) return null;
                  const top = ((meeting.start - firstHour * 60) / 60) * PX_PER_HOUR;
                  const h = ((meeting.end - meeting.start) / 60) * PX_PER_HOUR;
                  const inset = lanes > 1 ? 1.5 : 2;
                  const width = `calc(${100 / lanes}% - ${inset * 2}px)`;
                  const left = `calc(${(lane * 100) / lanes}% + ${inset}px)`;
                  const compact = h < 52;
                  const clash = clashing.has(uid(meeting));
                  return (
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(ev)}
                      aria-label={`View ${ev.course.code} ${meeting.type} section ${meeting.sec} details`}
                      key={uid(meeting)}
                      className={`event-card ${highlightedCourseId && highlightedCourseId !== ev.course.id ? 'event-dimmed-by-course' : ''} ${highlightedCourseId === ev.course.id ? 'event-course-highlight' : ''}`}
                      data-clash={clash ? 'true' : 'false'}
                      data-course-id={ev.course.id}
                      style={
                        clash
                          ? {
                              top: top + 1,
                              height: h - 3,
                              left,
                              width,
                              color: 'var(--warn)',
                              background: 'var(--warn-bg)',
                              borderLeftColor: 'var(--warn)',
                            }
                          : {
                              top: top + 1,
                              height: h - 3,
                              left,
                              width,
                              color: `var(--c${ev.course.c})`,
                              background: `var(--c${ev.course.c}-bg)`,
                              borderLeftColor: `var(--c${ev.course.c})`,
                            }
                      }
                      title={`${ev.course.code} — ${ev.course.name}\n${meeting.type} Sec ${meeting.sec} · ${DAY_LABEL[meeting.day]} ${formatRange(meeting.start, meeting.end)} · ${meeting.room}${
                        yearBadges?.[ev.course.id] ? `\n${yearBadges[ev.course.id]} course (added from another year)` : ''
                      }`}
                    >
                      <p className="mono truncate font-bold" style={{ fontSize: compact ? 9.5 : 10.5 }}>
                        {ev.course.code}
                      </p>
                      <p className="truncate font-semibold opacity-90" style={{ fontSize: compact ? 9 : 9.5 }}>
                        {shortType(meeting.type)} {meeting.sec} · {meeting.room}
                      </p>
                      {!compact && (
                        <p className="mono truncate opacity-75" style={{ fontSize: 9 }}>
                          {formatRange(meeting.start, meeting.end)}
                        </p>
                      )}
                    </button>
                  );
                })}
                {items.length === 0 && (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-[10.5px] font-medium"
                    style={{ color: 'var(--muted-2)' }}
                  >
                    free
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
    {selectedEvent && (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedEvent(null); }}>
        <div className="panel max-h-[92vh] w-full max-w-[680px] overflow-y-auto p-5 sm:p-7" role="dialog" aria-modal="true" aria-labelledby="session-details-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Planora · course details</p>
              <h2 id="session-details-title" className="mt-2 text-xl font-bold">{selectedEvent.course.code}: {selectedEvent.course.name}</h2>
            </div>
            <button type="button" className="btn px-3 py-1.5" aria-label="Close course details" onClick={() => setSelectedEvent(null)}>✕</button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Detail label="Term" value={TERM_SESSION_LABEL} />
            <Detail label="Credits" value={selectedEvent.course.credits == null ? 'Not published' : String(selectedEvent.course.credits)} />
            <Detail label="Component and section" value={`${selectedEvent.meeting.type} · ${selectedEvent.meeting.sec}`} />
            <Detail label="Instructor" value={selectedEvent.course.instructors.find(instructor => [...instructor.lectures, ...instructor.labs, ...instructor.tutorials].includes(selectedEvent.meeting))?.name ?? 'Not published'} />
            <Detail label="Schedule" value={`${DAY_LABEL[selectedEvent.meeting.day]} · ${formatRange(selectedEvent.meeting.start, selectedEvent.meeting.end)}`} />
            <Detail label="Room" value={selectedEvent.meeting.room || 'Not published'} />
          </div>
          <p className="mt-5 text-[11px]" style={{ color: 'var(--muted)' }}>Student planner · unofficial · data last verified {SEMESTER_CONFIG.dataLastVerified}. Enrollment, seats and course descriptions are not published in this planner.</p>
        </div>
      </div>
    )}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}

function shortType(type: Meeting['type']): string {
  if (type === 'Lecture') return 'Lec';
  if (type === 'Lab') return 'Lab';
  return 'Tut';
}
