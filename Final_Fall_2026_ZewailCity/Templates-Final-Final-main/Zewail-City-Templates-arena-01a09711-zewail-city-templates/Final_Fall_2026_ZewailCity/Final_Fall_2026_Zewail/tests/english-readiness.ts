import { COURSES, ENGLISH_LEVEL_CODES, ENGLISH_LEVEL_COURSE_IDS } from '../src/data/courses';
import { MAJORS, allAvailableCourseIds, sharedCourseIdsForMajor } from '../src/data/majors';
import { buildCoursePairings } from '../src/lib/scheduler';
import { overlaps } from '../src/lib/time';
import type { Course } from '../src/types';

const check = (condition: unknown, description: string) => { if (!condition) throw new Error(description); };
check(ENGLISH_LEVEL_CODES.join(',') === 'ENGL 003,ENGL 004,ENGL 156,ENGL 157', 'Leading zeroes or level codes were changed');
// Fixtures test availability before verified records exist; published levels are
// checked separately and this test remains valid when source-backed records arrive.
for (const code of ENGLISH_LEVEL_CODES) {
  check(COURSES.filter(course => course.code === code).length <= 1, `${code} must have no duplicate published record`);
}
check(new Set(ENGLISH_LEVEL_COURSE_IDS).size === ENGLISH_LEVEL_COURSE_IDS.length, 'Published English course IDs must remain unique');
check(ENGLISH_LEVEL_COURSE_IDS.length === 4, 'All four English shells should exist');
for (const code of ENGLISH_LEVEL_CODES) {
  const shell = COURSES.find(course => course.code === code)!;
  check(shell.awaitingSource && shell.noFixedSchedule && shell.credits === undefined && shell.instructors.length === 0, `${code}: no academic facts should be invented`);
}
const fixtures: Course[] = ENGLISH_LEVEL_CODES.map((code, index) => ({
  id: `test-engl-${code.slice(-3)}`, code, name: `Fixture ${code}`, c: 2, credits: index + 1,
  instructors: [{ name: 'Fixture instructor', lectures: [{ type: 'Lecture', sec: '01', day: 'Mon', start: 600, end: 720, room: 'Fixture room' }], labs: [], tutorials: [] }],
}));
const ids = fixtures.map(course => course.id);
for (const major of MAJORS) for (const year of major.years) {
  const offered = [...new Set([...year.courseIds, ...sharedCourseIdsForMajor(major, ids)])];
  check(ids.every(id => offered.includes(id)) && new Set(offered).size === offered.length,
    `${major.id}/${year.id}: verified English fixture options must be visible once and optional`);
  check(ids.every(id => allAvailableCourseIds(major, ids).includes(id)), `${major.id}: saved English selection should be allowed`);
  check(year.courseIds.every(id => !ids.includes(id)), `${major.id}/${year.id}: no English fixture should be automatically required`);
}
check(fixtures.every(course => buildCoursePairings(course).length === 1), 'A verified English meeting should be selectable');
check(overlaps(fixtures[0].instructors[0].lectures[0], fixtures[1].instructors[0].lectures[0]), 'Two conflicting English sections must conflict');
check(fixtures.slice(0, 2).reduce((sum, course) => sum + (course.credits ?? 0), 0) === 3, 'Chosen levels must count their published credit values');
console.log('English readiness: all four optional shells are shared, empty and await verified course details');
