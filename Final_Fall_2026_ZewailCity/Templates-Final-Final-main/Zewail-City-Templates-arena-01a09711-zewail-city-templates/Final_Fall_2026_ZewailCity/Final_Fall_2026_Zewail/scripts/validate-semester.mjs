import { readFileSync } from 'node:fs';

const load = name => JSON.parse(readFileSync(new URL(`../src/semester/${name}.json`, import.meta.url), 'utf8'));
const { courses, sch, majors, semester } = {
  courses: load('courses'), sch: load('sch'), majors: load('majors'), semester: load('semester'),
};
const issues = [];
const assert = (condition, message) => { if (!condition) issues.push(message); };
assert(Array.isArray(courses) && Array.isArray(sch) && Array.isArray(majors), 'Courses, SCH and majors must be arrays');
assert(typeof semester.key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(semester.calendarStartDate) && /^\d{4}-\d{2}-\d{2}$/.test(semester.calendarEndDate) && semester.calendarStartDate <= semester.calendarEndDate, 'Invalid semester key or calendar dates');
const all = [...courses, ...sch];
const ids = new Set();
let meetings = 0, missingRooms = 0, unassigned = 0;
for (const course of all) {
  assert(typeof course.id === 'string' && course.id.length > 0 && !ids.has(course.id), `Duplicate or missing course ID: ${course.id}`);
  ids.add(course.id);
  assert(typeof course.name === 'string' && course.name.length > 0 && typeof course.code === 'string' && course.code.length > 0, `Incomplete course: ${course.id}`);
  assert(Number.isFinite(course.credits) && course.credits >= 0 && course.credits <= 21, `Missing or invalid credits: ${course.id}`);
  for (const teacher of course.instructors ?? []) {
    assert(typeof teacher.name === 'string' && teacher.name.length > 0, `Missing instructor: ${course.id}`);
    if (teacher.unassigned) unassigned++;
    for (const meeting of [...(teacher.lectures ?? []), ...(teacher.labs ?? []), ...(teacher.tutorials ?? [])]) {
      meetings++;
      assert(['Sun','Mon','Tue','Wed','Thu'].includes(meeting.day) && Number.isInteger(meeting.start) && Number.isInteger(meeting.end) && meeting.start < meeting.end && meeting.end <= 1440 && meeting.start >= 0, `Invalid time/day: ${course.id} ${meeting.sec}`);
      assert(typeof meeting.sec === 'string' && meeting.sec.length > 0, `Missing section: ${course.id}`);
      if (!meeting.room) missingRooms++;
    }
  }
}
for (const major of majors) for (const year of major.years ?? []) for (const id of year.courseIds ?? []) assert(ids.has(id), `Broken major reference: ${major.id}/${year.id}/${id}`);
console.log(`Semester: ${semester.term} ${semester.year} · ${semester.session}`);
console.log(`${all.length} courses · ${meetings} meetings · ${sch.length} SCH electives`);
console.log(`${missingRooms} rooms unpublished · ${unassigned} instructor groups unassigned · ${issues.length} structural errors`);
if (issues.length) { issues.forEach(issue => console.error(`ERROR: ${issue}`)); process.exitCode = 1; }
else console.log('PASS');
