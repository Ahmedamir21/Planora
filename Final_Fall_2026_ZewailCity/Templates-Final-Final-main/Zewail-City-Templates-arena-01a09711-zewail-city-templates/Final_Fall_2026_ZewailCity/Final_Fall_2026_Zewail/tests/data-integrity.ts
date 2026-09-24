import { COURSES, COURSE_BY_ID } from '../src/data/courses';
import { MAJORS, COMMON_COURSE_IDS } from '../src/data/majors';
import { SEMESTER_CONFIG } from '../src/config/semester';
import type { Meeting } from '../src/types';

let pass = 0;
let fail = 0;
const warnings: string[] = [];

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const ids = COURSES.map((course) => course.id);
const codes = COURSES.map((course) => course.code);
check('course ids are unique', new Set(ids).size === ids.length);
check('course codes are unique in the active semester dataset', new Set(codes).size === codes.length);
check('COURSE_BY_ID contains every course exactly once', Object.keys(COURSE_BY_ID).length === COURSES.length && COURSES.every((course) => COURSE_BY_ID[course.id] === course));

const referencedIds = new Set<string>(COMMON_COURSE_IDS);
MAJORS.forEach((major) => {
  const yearIds = major.years.map((year) => year.id);
  check(`${major.id}: year ids are unique`, new Set(yearIds).size === yearIds.length);

  major.years.forEach((year) => {
    check(`${major.id}/${year.id}: course ids are unique`, new Set(year.courseIds).size === year.courseIds.length);
    year.courseIds.forEach((id) => {
      referencedIds.add(id);
      check(`${major.id}/${year.id}: ${id} exists`, Boolean(COURSE_BY_ID[id]));
    });
  });
});

COMMON_COURSE_IDS.forEach((id) => check(`common course ${id} exists`, Boolean(COURSE_BY_ID[id])));

const validDays = new Set(['Sun', 'Mon', 'Tue', 'Wed', 'Thu']);
const meetingKey = (courseId: string, instructorIndex: number, meeting: Meeting) =>
  [courseId, instructorIndex, meeting.type, meeting.sec, meeting.day, meeting.start, meeting.end, meeting.room].join('|');

COURSES.forEach((course) => {
  check(`${course.code}: id is non-empty`, Boolean(course.id.trim()));
  check(`${course.code}: code is non-empty`, Boolean(course.code.trim()));
  check(`${course.code}: name is non-empty`, Boolean(course.name.trim()));
  check(`${course.code}: palette index is 1..7`, Number.isInteger(course.c) && course.c >= 1 && course.c <= 7);
  check(`${course.code}: credits are valid when present`, course.credits == null || (Number.isFinite(course.credits) && course.credits >= 0 && course.credits <= 21));
  check(`${course.code}: has at least one instructor bucket`, course.instructors.length > 0);

  const meetings: Meeting[] = [];
  const identities = new Set<string>();

  course.instructors.forEach((instructor, instructorIndex) => {
    check(`${course.code}: instructor ${instructorIndex + 1} has a name`, Boolean(instructor.name.trim()));
    if (/instructor\s+not\s+assigned/i.test(instructor.name)) {
      check(`${course.code}: unassigned instructor bucket is flagged`, instructor.unassigned === true);
    }

    const lists = [instructor.lectures, instructor.labs, instructor.tutorials];
    lists.flat().forEach((meeting) => {
      meetings.push(meeting);
      check(`${course.code} Sec ${meeting.sec}: valid day`, validDays.has(meeting.day));
      check(`${course.code} Sec ${meeting.sec}: start is valid`, Number.isFinite(meeting.start) && meeting.start >= 0 && meeting.start < 24 * 60);
      check(`${course.code} Sec ${meeting.sec}: end is valid`, Number.isFinite(meeting.end) && meeting.end > 0 && meeting.end <= 24 * 60);
      check(`${course.code} Sec ${meeting.sec}: positive duration`, meeting.end > meeting.start);
      check(`${course.code} Sec ${meeting.sec}: section id is present`, Boolean(meeting.sec.trim()));

      if (!meeting.room.trim()) warnings.push(`${course.code} ${meeting.type} Sec ${meeting.sec} has no published room`);

      const key = meetingKey(course.id, instructorIndex, meeting);
      check(`${course.code}: no exact duplicate meeting in one instructor bucket`, !identities.has(key), key);
      identities.add(key);
    });
  });

  if (course.noFixedSchedule) {
    check(`${course.code}: noFixedSchedule courses publish zero meetings`, meetings.length === 0);
  } else {
    check(`${course.code}: scheduled courses publish at least one meeting`, meetings.length > 0);
  }
});

check('semester term is configured', Boolean(SEMESTER_CONFIG.term.trim()));
check('semester year is configured', Number.isInteger(SEMESTER_CONFIG.year) && SEMESTER_CONFIG.year >= 2020);
check('session is configured', Boolean(SEMESTER_CONFIG.session.trim()));
check('verification date is ISO-like', /^\d{4}-\d{2}-\d{2}$/.test(SEMESTER_CONFIG.dataLastVerified));

if (warnings.length) {
  console.log('\nDATA WARNINGS (allowed, review against Self-Service):');
  warnings.forEach((warning) => console.log('WARN:', warning));
}

console.log(`\nData integrity: ${pass} passed, ${fail} failed, ${warnings.length} warning(s)`);
if (fail > 0) process.exit(1);
