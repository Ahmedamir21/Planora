import type { Course, Meeting } from '../types';
import { buildCourseOptions, buildCoursePairings, measureSchedule } from './scheduler';
import { generateBestSchedules } from './bestSchedule';
import { DEFAULT_PREFERENCES } from './preferences';
import { DAY_LABEL, formatRange, overlaps } from './time';

export type AuditCheck = { title: string; detail: string; passed: boolean };

const describe = (meeting: Meeting) => `${DAY_LABEL[meeting.day]} ${formatRange(meeting.start, meeting.end)}`;
const meetingsOf = (course: Course) => course.instructors.flatMap((instructor) =>
  [...instructor.lectures, ...instructor.labs, ...instructor.tutorials]);
const hasOverlap = (meetings: Meeting[]) => meetings.some((a, i) => meetings.slice(i + 1).some((b) => overlaps(a, b)));

/** Admin-only checks against the published catalog; no section counts or instructor positions are assumed. */
export function runEngineAudit(courses: Course[]): AuditCheck[] {
  const byId = new Map(courses.map((course) => [course.id, course]));
  const phys = byId.get('phys104');
  const csai202 = byId.get('csai202');
  const csai205 = byId.get('csai205');
  const it205 = byId.get('it205');
  const core = ['csai201', 'csai202', 'csai203'].map((id) => byId.get(id)).filter((course): course is Course => !!course);
  const published = courses.flatMap((course) => meetingsOf(course).map((meeting) => ({ course, meeting })));
  const physMeetings = phys ? meetingsOf(phys) : [];
  const pairings = new Map(courses.map((course) => [course.id, buildCoursePairings(course)]));
  const checks: AuditCheck[] = [];
  const add = (title: string, passed: boolean, detail: string) => checks.push({ title, passed, detail });

  const adjacent = physMeetings.find((a) => a.type === 'Tutorial' && a.end - a.start === 60 &&
    physMeetings.some((b) => b.type === 'Lab' && b.day === a.day && b.start === a.end));
  const adjacentLab = adjacent && physMeetings.find((b) => b.type === 'Lab' && b.day === adjacent.day && b.start === adjacent.end);
  add('Back-to-back one-hour sessions do NOT conflict', !!adjacent && !!adjacentLab && !overlaps(adjacent, adjacentLab),
    adjacent && adjacentLab ? `PHYS 104 tutorial ${adjacent.sec} (${describe(adjacent)}) vs lab ${adjacentLab.sec} (${describe(adjacentLab)})` : 'No published adjacent PHYS 104 tutorial/lab example.');

  const inside = physMeetings.find((a) => a.type === 'Tutorial' && physMeetings.some((b) =>
    b.type === 'Lab' && b.day === a.day && b.start < a.start && a.end <= b.end));
  const insideLab = inside && physMeetings.find((b) => b.type === 'Lab' && b.day === inside.day && b.start < inside.start && inside.end <= b.end);
  add('A tutorial inside a two-hour lab DOES conflict', !!inside && !!insideLab && overlaps(inside, insideLab),
    inside && insideLab ? `PHYS 104 tutorial ${inside.sec} (${describe(inside)}) vs lab ${insideLab.sec} (${describe(insideLab)})` : 'No published PHYS 104 tutorial inside a lab.');

  const partial = published.find(({ meeting: a }) => published.some(({ meeting: b }) =>
    a.day === b.day && a.start < b.start && b.start < a.end && a.end < b.end));
  const partialSecond = partial && published.find(({ meeting: b }) =>
    partial.meeting.day === b.day && partial.meeting.start < b.start && b.start < partial.meeting.end && partial.meeting.end < b.end);
  add('Partial overlap DOES conflict', !!partial && !!partialSecond && overlaps(partial.meeting, partialSecond.meeting),
    partial && partialSecond ? `${partial.course.code} ${partial.meeting.type} ${partial.meeting.sec} (${describe(partial.meeting)}) vs ${partialSecond.course.code} ${partialSecond.meeting.type} ${partialSecond.meeting.sec} (${describe(partialSecond.meeting)})` : 'No published partial overlap example.');

  const endsAtLab = physMeetings.find((a) => a.type === 'Tutorial' && physMeetings.some((b) => b.type === 'Lab' && b.day === a.day && a.end === b.start));
  const startsAtEnd = endsAtLab && physMeetings.find((b) => b.type === 'Lab' && b.day === endsAtLab.day && endsAtLab.end === b.start);
  add('Tutorial ending exactly when a lab starts does NOT conflict', !!endsAtLab && !!startsAtEnd && !overlaps(endsAtLab, startsAtEnd),
    endsAtLab && startsAtEnd ? `PHYS 104 tutorial ${endsAtLab.sec} vs lab ${startsAtEnd.sec} · ${describe(endsAtLab)} / ${describe(startsAtEnd)}` : 'No published PHYS 104 tutorial ending when a lab starts.');

  const differentDay = published.find(({ meeting: a }) => published.some(({ meeting: b }) => a.day !== b.day && a.start === b.start && a.end === b.end));
  const differentDaySecond = differentDay && published.find(({ meeting: b }) => differentDay.meeting.day !== b.day && differentDay.meeting.start === b.start && differentDay.meeting.end === b.end);
  add('Different days never conflict, even at identical times', !!differentDay && !!differentDaySecond && !overlaps(differentDay.meeting, differentDaySecond.meeting),
    differentDay && differentDaySecond ? `${describe(differentDay.meeting)} vs ${describe(differentDaySecond.meeting)}` : 'No matching published slots on different days.');

  const differentRooms = published.find(({ meeting: a }) => published.some(({ meeting: b }) => a !== b && a.day === b.day && a.start === b.start && a.end === b.end && a.room !== b.room));
  const differentRoomsSecond = differentRooms && published.find(({ meeting: b }) => differentRooms.meeting !== b && differentRooms.meeting.day === b.day && differentRooms.meeting.start === b.start && differentRooms.meeting.end === b.end && differentRooms.meeting.room !== b.room);
  add('Same slot in different rooms still conflicts', !!differentRooms && !!differentRoomsSecond && overlaps(differentRooms.meeting, differentRoomsSecond.meeting),
    differentRooms && differentRoomsSecond ? `${differentRooms.meeting.room} vs ${differentRoomsSecond.meeting.room} · ${describe(differentRooms.meeting)}` : 'No matching published slots in different rooms.');

  const oneHour = published.find(({ meeting }) => meeting.end - meeting.start === 60)?.meeting;
  const twoHour = published.find(({ meeting }) => meeting.end - meeting.start === 120)?.meeting;
  add('Durations are exact end − start (no one-minute padding)', !!oneHour && !!twoHour &&
    measureSchedule([oneHour, twoHour]).meetingMinutes === 180,
    oneHour && twoHour ? `${oneHour.end - oneHour.start} min + ${twoHour.end - twoHour.start} min = 180 min` : 'A one-hour or two-hour published meeting is missing.');

  function expectedPairingCount(course: Course) {
    const pools = buildCourseOptions(course);
    const groups = [pools.Lecture, pools.Lab, pools.Tutorial].filter((items) => items.length);
    if (!groups.length) return 0;
    let candidates: Meeting[][] = [[]];
    for (const group of groups) candidates = candidates.flatMap((base) => group
      .filter(({ meeting }) => !base.some((other) => overlaps(meeting, other)))
      .map(({ meeting }) => [...base, meeting]));
    return candidates.length;
  }
  const physOptions = phys && buildCourseOptions(phys);
  const physRaw = physOptions ? [physOptions.Lecture, physOptions.Lab, physOptions.Tutorial].filter((pool) => pool.length).reduce((n, pool) => n * pool.length, 1) : 0;
  const physCount = pairings.get('phys104')?.length ?? 0;
  add('PHYS 104 pairings exclude only real time clashes', !!phys && physRaw > physCount && physCount === expectedPairingCount(phys),
    `Published: ${physRaw} raw combinations, ${physCount} valid, ${physRaw - physCount} clashes. Instructor groups: ${phys?.instructors.length ?? 0}.`);

  const cross = csai202 && pairings.get('csai202')?.filter((pairing) => pairing.instructors?.Lecture !== undefined && pairing.instructors.Lab !== undefined && pairing.instructors.Lecture !== pairing.instructors.Lab);
  add('Lecture and lab may come from DIFFERENT instructors (CSAI 202)', !!csai202 && !!cross?.length && pairings.get('csai202')?.length === expectedPairingCount(csai202),
    `${pairings.get('csai202')?.length ?? 0} valid pairings, ${cross?.length ?? 0} cross-instructor lecture/lab pairings.`);

  const circuitOptions = csai205 && buildCourseOptions(csai205);
  const circuits = circuitOptions ? [circuitOptions.Lecture, circuitOptions.Lab, circuitOptions.Tutorial].filter((pool) => pool.length) : [];
  const circuitRaw = circuits.length ? circuits.reduce((n, pool) => n * pool.length, 1) : 0;
  add('Time clashes exclude sections regardless of instructor (CSAI 205)', !!csai205 && circuitRaw > (pairings.get('csai205')?.length ?? 0) && pairings.get('csai205')?.length === expectedPairingCount(csai205),
    `${circuitRaw} raw combinations, ${pairings.get('csai205')?.length ?? 0} valid after time clashes.`);

  const fixed = it205 && buildCourseOptions(it205);
  add('Fixed-slot courses keep exactly their one combo (IT 205)', !!fixed && fixed.Lecture.length === 1 && fixed.Lab.length === 1 && pairings.get('it205')?.length === 1,
    `Published: ${fixed?.Lecture.length ?? 0} lecture, ${fixed?.Lab.length ?? 0} lab, ${pairings.get('it205')?.length ?? 0} valid pairing.`);

  const safe = courses.every((course) => (pairings.get(course.id) ?? []).every((pairing) =>
    !hasOverlap(pairing.meetings) && pairing.meetings.every((meeting) => meetingsOf(course).includes(meeting))));
  add('No pairing contains an overlap or an invented meeting', safe, `${courses.length} courses and ${[...pairings.values()].reduce((n, list) => n + list.length, 0)} pairings checked against published meetings.`);

  const normal = core.length === 3 ? generateBestSchedules(core, DEFAULT_PREFERENCES) : null;
  add('Best Schedule never returns a conflicting schedule', !!normal?.schedules.length && normal.schedules.every((schedule) => !hasOverlap(schedule.meetings)),
    `${normal?.schedules.length ?? 0} generated schedules checked.`);
  const scores = normal?.schedules.map((schedule) => schedule.scorePercent) ?? [];
  add('Returned schedules are ranked in non-increasing preference score', scores.length > 0 && scores.every((score, i) => i === 0 || scores[i - 1] >= score),
    `${scores.length} schedules ranked; ${normal?.truncated ? 'search budget reached' : 'search completed'}.`);

  const hard = core.length === 3 ? generateBestSchedules(core, {
    ...DEFAULT_PREFERENCES, keepFreeDays: ['Wed'], keepFreeDaysHard: true, maxHoursPerDay: 4, maxHoursHard: true,
  }) : null;
  add('A HARD constraint excludes violating schedules', !!hard &&
    hard.schedules.every((schedule) => !schedule.meetings.some((meeting) => meeting.day === 'Wed') &&
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].every((day) => schedule.meetings.filter((meeting) => meeting.day === day).reduce((n, meeting) => n + meeting.end - meeting.start, 0) <= 240)) &&
    (!!hard.schedules.length || !!hard.blockedByHard.length || !!hard.unsatisfiableHard.length),
    `${hard?.schedules.length ?? 0} matching schedules; ${hard?.blockedByHard.length ?? 0} courses blocked by hard constraints.`);

  const impossible = core.length >= 2 ? generateBestSchedules(core.slice(0, 2), {
    ...DEFAULT_PREFERENCES, preferredStart: 480, preferredEnd: 481, timeRangeHard: true,
  }) : null;
  add('Impossible hard constraints are reported, not silently dropped', !!impossible && impossible.schedules.length === 0 &&
    (impossible.blockedByHard.length > 0 || impossible.unsatisfiableHard.length > 0),
    `${impossible?.blockedByHard.length ?? 0} blocked courses; ${impossible?.unsatisfiableHard.length ?? 0} unmet constraints.`);
  return checks;
}
