import { check, mm } from './shared';
import { COURSE_BY_ID, COURSES } from '../../src/data/courses';
import { overlaps } from '../../src/lib/time';
import { buildCoursePairings, buildPairings } from '../../src/lib/scheduler-parts/pairings';
import { measureSchedule } from '../../src/lib/scheduler-parts/measure';
import { computeFreeTime, WINDOW_START, WINDOW_END } from '../../src/lib/freeTime';
import { draftMeetings, draftOverlaps, meetingOption, uid, type PickState } from '../../src/lib/picks';
import { csai203 } from './p3-share';

// Conflict rules, durations and free-time math.
/* ================= 1. conflict rules (end-exclusive) ================= */
check('adjacent 60-min blocks do not conflict', !overlaps(mm('Sun', 480, 540), mm('Sun', 540, 600)));
check('1-min overlap conflicts', overlaps(mm('Sun', 480, 541), mm('Sun', 540, 600)));
check('different days never conflict', !overlaps(mm('Sun', 480, 600), mm('Mon', 480, 600)));
check('same time different room still conflicts', overlaps(mm('Sun', 480, 600), mm('Sun', 480, 600, 'Lecture', 'x', 'other')));

/* ================= 2. exact durations ================= */
check('measureSchedule sums exact minutes', measureSchedule([mm('Sun', 480, 540), mm('Mon', 600, 720)]).meetingMinutes === 180);
export const phys = COURSE_BY_ID['phys104'];
check('PHYS 104 has at least one valid pairing', buildCoursePairings(phys).length > 0);
check('every course pairing (ALL courses) is internally conflict-free', (() => {
  return Object.values(COURSE_BY_ID).every((c) => {
    const ps = buildCoursePairings(c);
    for (const p of ps) {
      for (let i = 0; i < p.meetings.length; i++)
        for (let j = i + 1; j < p.meetings.length; j++) if (overlaps(p.meetings[i], p.meetings[j])) return false;
    }
    return true;
  });
})());
check('pairings never invent meetings: every entry is a published section', (() => {
  return Object.values(COURSE_BY_ID).every((c) =>
    buildCoursePairings(c).every((p) =>
      p.meetings.every((m) => c.instructors.some((i) => [i.lectures, i.labs, i.tutorials].some((pool) => pool.includes(m)))),
    ),
  );
})());

/* 2a. current MATH 105 instructor data + replacement semantics */
{
  const math105 = COURSE_BY_ID['math105'];
  const sec03 = math105.instructors.flatMap((i) => i.lectures).find((m) => m.sec === '03')!;
  check('MATH 105 Lecture Sec 03 is owned by Ahmed El-Deeb',
    meetingOption(math105, sec03)?.instructor.name === 'Ahmed El-Deeb');

  const sec02 = math105.instructors.flatMap((i) => i.lectures).find((m) => m.sec === '02')!;
  const picks: PickState = { math105: { Lecture: uid(sec02), Lab: null, Tutorial: null } };
  picks.math105.Lecture = uid(sec03);
  const finalDraft = draftMeetings([math105], picks);
  check('replacing MATH 105 Lecture Sec 02 with Sec 03 keeps only one lecture',
    finalDraft.filter((d) => d.courseId === 'math105' && d.meeting.type === 'Lecture').length === 1 &&
    finalDraft[0]?.meeting.sec === '03');
  check('a replacement is checked only in its final state, not against the meeting it replaced',
    draftOverlaps(finalDraft).length === 0);
}

/* 2b. cross-instructor pairing: mixing groups may widen the space but must never remove valid same-group pairings */
{
  const perGroup = (id: string) => COURSE_BY_ID[id].instructors.reduce((a, i) => a + buildPairings(i).length, 0);
  const cross = (id: string) => buildCoursePairings(COURSE_BY_ID[id]).length;

  ['csai201', 'csai202', 'csai203', 'math105'].forEach((id) => {
    check(`${COURSE_BY_ID[id].code}: cross-instructor pairing never narrows the valid space`, cross(id) >= perGroup(id));
  });

  const singleInstructor = COURSES.filter((course) => course.instructors.length === 1 && !course.noFixedSchedule);
  check('single-instructor courses keep the same pairing count', singleInstructor.every((course) =>
    buildCoursePairings(course).length === buildPairings(course.instructors[0]).length));

  const c205 = buildCoursePairings(COURSE_BY_ID['csai205']);
  check('every CSAI 205 generated pairing is internally conflict-free', c205.every((pairing) =>
    pairing.meetings.every((a, i) => pairing.meetings.every((b, j) => i === j || !overlaps(a, b)))));

  const c202 = buildCoursePairings(COURSE_BY_ID['csai202']);
  check('CSAI 202 lecture-only instructor can pair with another instructor lab when times allow',
    c202.some((pairing) => pairing.lecture?.sec === '03' && pairing.instructors?.Lab != null && pairing.instructors.Lab !== pairing.instructors.Lecture));
}

/* ================= 3. free-time math (real times, defined window) ================= */
const ft = computeFreeTime([mm('Sun', 480, 540)]);
check('window is 08:00–18:00', WINDOW_START === 480 && WINDOW_END === 1080);
check('occupied = exact 60 min', ft.occupiedMinutes === 60);
check('free = 5×600 − 60 minutes', ft.freeMinutes === 5 * 600 - 60);
check('freeHours keeps decimals (49h)', Math.abs(ft.freeHours - 49) < 1e-9);
check('perDay Sun occupied 60', ft.perDay.find((d) => d.day === 'Sun')!.occupied === 60);
check('perDay Mon free = whole window', ft.perDay.find((d) => d.day === 'Mon')!.freeMinutes === 600);
const ft2 = computeFreeTime([mm('Sun', 480, 600), mm('Sun', 540, 660)]);
check('double-booked union counted once (occupied 180)', ft2.occupiedMinutes === 180);
check('overlap minutes reported (60)', ft2.overlapMinutes === 60);
const ft3 = computeFreeTime([mm('Sun', 420, 480), mm('Sun', 1020, 1140)]);
check('clips to window edges (only 1020–1080 counts)', ft3.occupiedMinutes === 60 && ft3.outsideWindowMinutes === 120);
