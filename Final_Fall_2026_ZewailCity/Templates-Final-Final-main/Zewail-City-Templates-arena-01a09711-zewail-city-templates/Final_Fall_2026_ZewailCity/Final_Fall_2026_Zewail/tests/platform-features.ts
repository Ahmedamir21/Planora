import { COURSE_BY_ID } from '../src/data/courses';
import { buildCalendarIcs } from '../src/lib/calendar';
import { courseIssueText, generalIssueText } from '../src/lib/reportIssue';
import { clearPlannerState } from '../src/lib/recovery';
import { optionsFor, type DraftMeeting } from '../src/lib/picks';

let pass = 0;
let fail = 0;
function check(name: string, condition: boolean) {
  if (condition) {
    pass++;
    console.log('PASS:', name);
  } else {
    fail++;
    console.error('FAIL:', name);
  }
}

const math = COURSE_BY_ID.math105;
const option = optionsFor(math, 'Lecture')[0];
check('calendar test has a published lecture', Boolean(option));

if (option) {
  const draft: DraftMeeting[] = [{
    courseId: math.id,
    course: math,
    option,
    meeting: option.meeting,
  }];
  const ics = buildCalendarIcs(draft);
  check('ICS has a VCALENDAR shell', ics.includes('BEGIN:VCALENDAR') && ics.includes('END:VCALENDAR'));
  check('ICS exports Africa/Cairo local time', ics.includes('TZID=Africa/Cairo'));
  check('ICS is weekly and bounded by count', /RRULE:FREQ=WEEKLY;COUNT=\d+/.test(ics));
  check('ICS contains course and component', ics.includes(math.code) && ics.includes(option.meeting.type));
  check('ICS contains room or published fallback', Boolean(option.meeting.room ? ics.includes(option.meeting.room) : ics.includes('Room not published')));

  const issue = courseIssueText(math, {
    Lecture: option.key,
    Lab: null,
    Tutorial: null,
  });
  check('course report includes exact course code', issue.includes(math.code));
  check('course report includes exact section', issue.includes(`Sec ${option.meeting.sec}`));
  check('course report includes instructor', issue.includes(option.instructor.unassigned ? 'Instructor not assigned' : option.instructor.name));
}

check('general report contains required fields', ['Course code:', 'Section:', 'Issue found:'].every((x) => generalIssueText().includes(x)));

const store = new Map<string, string>([
  ['zw-app-state-v2', 'x'],
  ['zw-schedule-prefs-v1', 'x'],
  ['zc-planner-locks-v1', 'x'],
  ['zc-planner-locks-v2:fall-2026-main', 'x'],
  ['zc-assistant-constraints-v1', 'x'],
  ['zc-assistant-constraints-v2:fall-2026-main', 'x'],
  ['tsp-theme', 'dark'],
]);

(globalThis as any).window = {
  localStorage: {
    removeItem: (key: string) => store.delete(key),
  },
};

clearPlannerState();
check('recovery clears planner app state', !store.has('zw-app-state-v2'));
check('recovery clears planner preferences', !store.has('zw-schedule-prefs-v1'));
check('recovery clears term locks', !store.has('zc-planner-locks-v2:fall-2026-main'));
check('recovery clears term assistant constraints', !store.has('zc-assistant-constraints-v2:fall-2026-main'));
check('recovery preserves theme preference', store.get('tsp-theme') === 'dark');

console.log(`\nPlatform features: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
