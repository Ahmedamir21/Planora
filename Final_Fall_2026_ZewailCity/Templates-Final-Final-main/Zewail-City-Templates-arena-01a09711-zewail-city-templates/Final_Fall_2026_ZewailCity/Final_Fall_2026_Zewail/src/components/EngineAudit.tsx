import { useMemo } from 'react';
import { COURSE_BY_ID } from '../data/courses';
import { buildCoursePairings, measureSchedule } from '../lib/scheduler';
import { generateBestSchedules, hardConstraintsActive } from '../lib/bestSchedule';
import { DEFAULT_PREFERENCES } from '../lib/preferences';
import { DAY_LABEL, formatRange, overlaps } from '../lib/time';
import type { Course, Meeting } from '../types';

function find(
  courseId: string,
  instructorName: string,
  type: Meeting['type'],
  sec: string,
): Meeting | undefined {
  const course = COURSE_BY_ID[courseId];
  const instr = course?.instructors.find((i) => i.name === instructorName);
  if (!instr) return undefined;
  const pool = type === 'Lecture' ? instr.lectures : type === 'Lab' ? instr.labs : instr.tutorials;
  return pool.find((m) => m.sec === sec);
}

function label(m: Meeting | undefined): string {
  if (!m) return '—';
  return `${DAY_LABEL[m.day]} ${formatRange(m.start, m.end)}`;
}

export function EngineAudit({
  combos,
  truncated,
}: {
  combos: number;
  truncated: boolean;
}) {
  const checks = useMemo(() => {
    const phys = COURSE_BY_ID['phys104'];
    const physInstr = phys.instructors[0];
    const csai203Rakha = COURSE_BY_ID['csai203'].instructors[0];
    const csai205 = COURSE_BY_ID['csai205'];
    const swSoftware = COURSE_BY_ID['csai203'];

    /** Course-wide (cross-instructor) pairing count helper for the audit rows above. */
    const coursePairings = (c: Course) => buildCoursePairings(c).length;

    return [
      {
        title: 'Back-to-back one-hour sessions do NOT conflict',
        detail: `PHYS 104 Tutorial 02 (${label(find('phys104', physInstr.name, 'Tutorial', '02'))}) vs Lab 03 (${label(
          find('phys104', physInstr.name, 'Lab', '03'),
        )})`,
        expect: false,
        actual: (() => {
          const a = find('phys104', physInstr.name, 'Tutorial', '02');
          const b = find('phys104', physInstr.name, 'Lab', '03');
          return a && b ? overlaps(a, b) : false;
        })(),
      },
      {
        title: 'A tutorial inside a two-hour lab DOES conflict',
        detail: `PHYS 104 Lab 02 (${label(find('phys104', physInstr.name, 'Lab', '02'))}) vs Tutorial 03 (${label(
          find('phys104', physInstr.name, 'Tutorial', '03'),
        )})`,
        expect: true,
        actual: (() => {
          const a = find('phys104', physInstr.name, 'Lab', '02');
          const b = find('phys104', physInstr.name, 'Tutorial', '03');
          return a && b ? overlaps(a, b) : false;
        })(),
      },
      {
        title: 'Partial overlap (3:00–4:59 PM vs 2:00–3:59 PM) DOES conflict',
        detail: `PHYS 104 Lab 04 (${label(find('phys104', physInstr.name, 'Lab', '04'))}) vs Lab 02 (${label(
          find('phys104', physInstr.name, 'Lab', '02'),
        )})`,
        expect: true,
        actual: (() => {
          const a = find('phys104', physInstr.name, 'Lab', '04');
          const b = find('phys104', physInstr.name, 'Lab', '02');
          return a && b ? overlaps(a, b) : false;
        })(),
      },
      {
        title: 'One-hour tutorial ending exactly when a lab starts does NOT conflict',
        detail: `PHYS 104 Tutorial 04 (${label(find('phys104', physInstr.name, 'Tutorial', '04'))}) vs Lab 04 (${label(
          find('phys104', physInstr.name, 'Lab', '04'),
        )})`,
        expect: false,
        actual: (() => {
          const a = find('phys104', physInstr.name, 'Tutorial', '04');
          const b = find('phys104', physInstr.name, 'Lab', '04');
          return a && b ? overlaps(a, b) : false;
        })(),
      },
      {
        title: 'Different days never conflict, even at identical times',
        detail: `CSAI 203 lecture (${label(
          find('csai203', csai203Rakha.name, 'Lecture', '01'),
        )}) vs Monday lab (${label(find('csai203', csai203Rakha.name, 'Lab', '01'))})`,
        expect: false,
        actual: (() => {
          const a = find('csai203', csai203Rakha.name, 'Lecture', '01');
          const b = find('csai203', csai203Rakha.name, 'Lab', '01');
          return a && b ? overlaps(a, b) : false;
        })(),
      },
      {
        title: 'Same slot in different rooms still conflicts',
        detail: `CSAI 203 Lab 01 · G0011D (${label(
          find('csai203', csai203Rakha.name, 'Lab', '01'),
        )}) vs Lab 03 · G014-E (${label(find('csai203', csai203Rakha.name, 'Lab', '03'))})`,
        expect: true,
        actual: (() => {
          const a = find('csai203', csai203Rakha.name, 'Lab', '01');
          const b = find('csai203', csai203Rakha.name, 'Lab', '03');
          return a && b ? overlaps(a, b) : false;
        })(),
      },
      {
        title: 'Durations are exact end − start (no +1-minute padding anywhere)',
        detail: 'PHYS 104 tutorial = 60 min · 2-hour block = 120 min · measureSchedule spans match',
        expect: true,
        actual: (() => {
          const tut = find('phys104', physInstr.name, 'Tutorial', '01');
          const lec = find('csai201', COURSE_BY_ID['csai201'].instructors[0].name, 'Lecture', '01');
          if (!tut || !lec) return false;
          const tutOk = tut.end - tut.start === 60;
          const lecOk = lec.end - lec.start === 120;
          const m = measureSchedule([tut, lec]);
          return tutOk && lecOk && m.meetingMinutes === 180;
        })(),
      },
      {
        title: 'PHYS 104 yields 13 valid pairings (unchanged — single instructor)',
        detail:
          '1 lecture × 4 tutorials × 4 labs = 16 raw, minus 3 time clashes (Tut 03 × Lab 02, Tut 03 × Lab 04, Tut 04 × Lab 02) = 13. Cross-instructor freedom cannot add anything here because this course has one group only.',
        expect: true,
        actual: coursePairings(phys) === 13,
      },
      {
        title: 'Lecture and lab may come from DIFFERENT instructors (CSAI 202)',
        detail:
          'Ashraf Hendam publishes only lecture Sec 03 (Sun) — its labs are unannounced. His lecture now legally pairs with every non-clashing lab of Yousry Abdelazeem: 3 lectures × 8 labs = 24 pairings instead of the 17 that instructor-locking allowed.',
        expect: true,
        actual: (() => {
          const ps = buildCoursePairings(COURSE_BY_ID['csai202']);
          const ashrafCross = ps.filter((p) => p.lecture?.sec === '03' && p.instructors?.Lab === 0);
          return ps.length === 24 && ashrafCross.length === 8;
        })(),
      },
      {
        title: 'Time clashes still exclude sections regardless of who teaches them (CSAI 205)',
        detail:
          'CSAI 205 has one instructor, so its space is untouched: 36 raw lecture×lab combos minus 2 published clashes (Lec 02 × Lab 11, Lec 03 × Lab 02 — same day, same block) = 34. The clash rule, not the instructor rule, is what removes them.',
        expect: true,
        actual: (() => {
          const ps = buildCoursePairings(csai205);
          return (
            ps.length === 34 &&
            !ps.some((p) => p.lecture?.sec === '02' && p.labs.some((l) => l.sec === '11')) &&
            !ps.some((p) => p.lecture?.sec === '03' && p.labs.some((l) => l.sec === '02'))
          );
        })(),
      },
      {
        title: 'Fixed-slot courses keep exactly their one combo (IT 205)',
        detail: 'One lecture (Mon B) and one lab (Mon D) — no clash, one valid pairing. Special cases fall out of the general rule instead of bypassing it.',
        expect: true,
        actual: buildCoursePairings(COURSE_BY_ID['it205']).length === 1,
      },
      {
        title: 'No combination contains a genuine time overlap — and nothing is invented',
        detail:
          'Every pairing of every course is re-checked pairwise with the real overlap rule, and every meeting in every pairing must exist verbatim in that course’s published sections (a course-wide pairing may mix groups but may not fabricate either).',
        expect: true,
        actual: (() => {
          const all = Object.values(COURSE_BY_ID);
          return all.every((c) => {
            const ps = buildCoursePairings(c);
            for (const p of ps) {
              for (let i = 0; i < p.meetings.length; i++)
                for (let j = i + 1; j < p.meetings.length; j++)
                  if (overlaps(p.meetings[i], p.meetings[j])) return false;
              if (
                p.meetings.some(
                  (m) =>
                    !c.instructors.some((ins) =>
                      [ins.lectures, ins.labs, ins.tutorials].some((pool) => pool.includes(m)),
                    ),
                )
              )
                return false;
            }
            return true;
          });
        })(),
      },
      {
        title: 'Best Schedule never returns a conflicting schedule',
        detail: 'Generates the Software-major core (CSAI 201 + CSAI 202 + CSAI 203) from default preferences and re-checks every returned schedule for overlaps.',
        expect: true,
        actual: (() => {
          const report = generateBestSchedules([swSoftware, COURSE_BY_ID['csai201'], COURSE_BY_ID['csai202']], DEFAULT_PREFERENCES);
          if (report.schedules.length === 0) return false;
          return report.schedules.every((s) => {
            for (let i = 0; i < s.meetings.length; i++) {
              for (let j = i + 1; j < s.meetings.length; j++) {
                if (overlaps(s.meetings[i], s.meetings[j])) return false;
              }
            }
            return true;
          });
        })(),
      },
      {
        title: 'Returned schedules are ranked in non-increasing preference score',
        detail: 'Pool sorting is checked against the actual scorePercent sequence of the generated results.',
        expect: true,
        actual: (() => {
          const report = generateBestSchedules([swSoftware, COURSE_BY_ID['csai201'], COURSE_BY_ID['csai202']], DEFAULT_PREFERENCES);
          const scores = report.schedules.map((s) => s.scorePercent);
          for (let i = 1; i < scores.length; i++) if (scores[i] > scores[i - 1]) return false;
          return scores.length > 0;
        })(),
      },
      {
        title: 'A HARD constraint excludes violating schedules instead of ignoring them',
        detail: 'Requiring Wednesday free + max 4 exact class hours/day must never be violated by a returned schedule.',
        expect: true,
        actual: (() => {
          const report = generateBestSchedules(
            [swSoftware, COURSE_BY_ID['csai201'], COURSE_BY_ID['csai202']],
            { ...DEFAULT_PREFERENCES, keepFreeDays: ['Wed'], keepFreeDaysHard: true, maxHoursPerDay: 4, maxHoursHard: true },
          );
          return report.schedules.every((s) => {
            const wedMeeting = s.meetings.some((m) => m.day === 'Wed');
            if (wedMeeting) return false;
            const perDay = new Map<string, number>();
            s.meetings.forEach((m) => perDay.set(m.day, (perDay.get(m.day) ?? 0) + (m.end - m.start)));
            return [...perDay.values()].every((mins) => mins <= 4 * 60);
          });
        })(),
      },
      {
        title: 'Impossible hard constraints are reported, not silently dropped',
        detail: hardConstraintsActive(DEFAULT_PREFERENCES)
          ? 'Hard flags are currently active on this device.'
          : 'Requiring every class inside 8:00–8:01 AM (hard) must produce the "required constraints" message.',
        expect: true,
        actual: (() => {
          const report = generateBestSchedules(
            [swSoftware, COURSE_BY_ID['csai201']],
            { ...DEFAULT_PREFERENCES, preferredStart: 480, preferredEnd: 481, timeRangeHard: true },
          );
          return report.schedules.length === 0 && (report.blockedByHard.length > 0 || report.totalValid === 0);
        })(),
      },
    ];
  }, []);

  const passed = checks.filter((c) => c.expect === c.actual).length;

  return (
    <details className="panel overflow-hidden no-print">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="text-[13px] font-bold tracking-tight">Scheduling engine audit</span>
        <span className="flex items-center gap-2">
          <span className="pill" style={{ color: passed === checks.length ? 'var(--ok)' : 'var(--warn)' }}>
            {passed}/{checks.length} checks passed
          </span>
          <span className="pill">{combos.toLocaleString()} combinations generated{truncated ? ' (capped in memory)' : ''}</span>
        </span>
      </summary>
      <div className="space-y-2 border-t px-4 py-3" style={{ borderColor: 'var(--line-soft)' }}>
        <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          Each check below is evaluated live from the published section data using the interval rule{' '}
          <span className="mono">sameDay &amp;&amp; startA &lt; endB &amp;&amp; startB &lt; endA</span>. Nothing here is hard-coded —
          the pass/fail badge is computed from the real meeting intervals on every render.
        </p>
        <ul className="space-y-1.5">
          {checks.map((c) => {
            const ok = c.expect === c.actual;
            return (
              <li
                key={c.title}
                className="panel-soft flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold leading-snug">{c.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--muted)' }}>
                    {c.detail}
                  </p>
                </div>
                <span
                  className="pill flex-none"
                  style={{ color: ok ? 'var(--ok)' : 'var(--warn)', borderColor: ok ? undefined : 'var(--warn-line)' }}
                >
                  {ok ? '✓ pass' : '✕ fail'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
