import type { Course, Instructor, Meeting, Pairing } from '../types';
import { DAY_LABEL, durationMinutes, formatMeeting } from '../lib/time';
import { meetingOption } from '../lib/picks';

export interface DetailEntry {
  course: Course;
  instructor: Instructor;
  pairing: Pairing;
}

export function ScheduleDetails({
  entries,
  yearBadges,
}: {
  entries: DetailEntry[];
  /** "Year X" badge per course id for cross-year additions. */
  yearBadges?: Record<string, string>;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="panel p-4 sm:p-5" aria-label="Schedule details">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-bold tracking-tight">Schedule Details</h2>
        <p className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
          Every meeting in this combination — sections, real times and rooms.
        </p>
      </div>

      <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => (
          <article key={entry.course.id} className="panel-soft overflow-hidden">
            <header
              className="flex items-start justify-between gap-2 border-b px-3.5 py-2.5"
              style={{ borderColor: 'var(--line-soft)', borderLeft: `3px solid var(--c${entry.course.c})` }}
            >
              <div className="min-w-0">
                <h3 className="mono truncate text-[13px] font-bold" style={{ color: `var(--c${entry.course.c})` }}>
                  {entry.course.code}
                </h3>
                <p className="truncate text-[11.5px]" style={{ color: 'var(--muted)' }}>
                  {entry.course.name}
                </p>
              </div>
              <div className="flex flex-none flex-col items-end gap-1">
                {entry.course.credits != null && <span className="pill">{entry.course.credits} credits</span>}
                {yearBadges?.[entry.course.id] && (
                  <span
                    className="pill"
                    style={{ color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--line))' }}
                    title="Added from another year of your major"
                  >
                    {yearBadges[entry.course.id]}
                  </span>
                )}
              </div>
            </header>

            <div className="px-3.5 py-2.5">
              <p className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                <span className="pill" style={{ flex: 'none' }}>
                  Instructor
                </span>
                {instructorLabels(entry).map((l) => (
                  <span key={l.kind} style={{ color: l.unassigned ? 'var(--warn)' : 'var(--ink)' }}>
                    {instructorLabels(entry).length > 1 ? `${l.kind}: ` : ''}{l.name}
                  </span>
                ))}
              </p>

              <table className="mt-2.5 w-full border-collapse text-left">
                <thead>
                  <tr style={{ color: 'var(--muted-2)' }}>
                    {['Type', 'Sec', 'Day', 'Time', 'Room'].map((h) => (
                      <th key={h} className="pb-1 text-[9.5px] font-bold uppercase tracking-[0.06em]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entry.pairing.meetings.map((meeting: Meeting, i: number) => (
                    <tr key={i} className="align-top" style={{ borderTop: '1px solid var(--line-soft)' }}>
                      <td className="py-1.5 pr-2 text-[11px] font-semibold" style={{ color: `var(--c${entry.course.c})` }}>
                        {meeting.type}
                      </td>
                      <td className="mono py-1.5 pr-2 text-[11px]">{meeting.sec}</td>
                      <td className="py-1.5 pr-2 text-[11px]">{DAY_LABEL[meeting.day].slice(0, 3)}</td>
                      <td className="py-1.5 pr-2 text-[11px]">
                        <span className="mono">{formatMeeting(meeting).replace(/^.*· /, '')}</span>
                        <span className="block text-[9.5px]" style={{ color: 'var(--muted-2)' }}>
                          {durationMinutes(meeting)} min
                        </span>
                      </td>
                      <td className="mono py-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>
                        {meeting.room}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {entry.pairing.meetings.length === 0 && (
                <p className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                  No scheduled meetings for this instructor.
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Per-component teacher labels — components may come from DIFFERENT instructors. */
function instructorLabels(entry: DetailEntry): { kind: string; name: string; unassigned?: boolean }[] {
  const out: { kind: string; name: string; unassigned?: boolean }[] = [];
  const seen = new Set<string>();
  entry.pairing.meetings.forEach((m) => {
    const instr = meetingOption(entry.course, m)?.instructor ?? entry.instructor;
    const name = instr?.unassigned ? 'Unassigned' : instr?.name ?? entry.instructor.name;
    const key = `${m.type}:${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind: m.type, name, unassigned: instr?.unassigned });
  });
  return out;
}
