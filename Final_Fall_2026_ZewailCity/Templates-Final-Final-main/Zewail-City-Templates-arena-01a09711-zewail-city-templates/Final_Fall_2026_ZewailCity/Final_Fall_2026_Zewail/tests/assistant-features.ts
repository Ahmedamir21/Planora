import { COURSE_BY_ID } from '../src/data/courses';
import { generateBestSchedules } from '../src/lib/bestSchedule';
import { DEFAULT_PREFERENCES } from '../src/lib/preferences';
import { buildCoursePairings } from '../src/lib/scheduler';
import { uid, type PickState } from '../src/lib/picks';
import {
  isComponentLocked,
  isCourseLocked,
  lockedPickForCourse,
  normalizeLocks,
  pairingMatchesLockedPick,
  type PlannerLocks,
} from '../src/lib/assistantControls';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log('PASS:', name);
  } else {
    fail++;
    console.error('FAIL:', name);
  }
}

const math = COURSE_BY_ID['math105'];
const mathPairings = buildCoursePairings(math);
const sec3Pairing = mathPairings.find((p) => p.lecture?.sec === '03');
check('MATH 105 Lecture Sec 03 exists', Boolean(sec3Pairing?.lecture));

if (sec3Pairing?.lecture) {
  const sec3Key = uid(sec3Pairing.lecture);
  const picks: PickState = {
    math105: { Lecture: sec3Key, Lab: null, Tutorial: null },
  };
  const componentLocks: PlannerLocks = {
    courseIds: [],
    components: { math105: { Lecture: true } },
  };

  check('component lock is detected', isComponentLocked(componentLocks, 'math105', 'Lecture'));
  check('unlocked tutorial stays unlocked', !isComponentLocked(componentLocks, 'math105', 'Tutorial'));

  const locked = lockedPickForCourse(picks, componentLocks, 'math105');
  check('locked pick stores current exact lecture', locked.Lecture === sec3Key);
  check(
    'pairing lock matcher rejects different MATH 105 lectures',
    mathPairings
      .filter((p) => pairingMatchesLockedPick(p, locked))
      .every((p) => p.lecture?.sec === '03'),
  );

  const report = generateBestSchedules([math], DEFAULT_PREFERENCES, picks, componentLocks);
  check('Best Schedule still returns results with a locked lecture', report.schedules.length > 0);
  check(
    'Best Schedule preserves locked MATH 105 Lecture Sec 03',
    report.schedules.every((schedule) =>
      schedule.perCourse.every((entry) =>
        entry.course.id !== 'math105' || entry.pairing.lecture?.sec === '03',
      ),
    ),
  );

  const courseLocks: PlannerLocks = { courseIds: ['math105'], components: {} };
  check('course lock is detected', isCourseLocked(courseLocks, 'math105'));
  const courseLocked = lockedPickForCourse(picks, courseLocks, 'math105');
  check('course lock preserves current selected lecture', courseLocked.Lecture === sec3Key);
}

const normalized = normalizeLocks(
  {
    courseIds: ['math105', 'does-not-exist'],
    components: {
      math105: { Lecture: true },
      'does-not-exist': { Lecture: true },
    },
  },
  { math105: { Lecture: null, Lab: null, Tutorial: null } },
);
check('normalization removes locks for courses not in current picks', normalized.courseIds.length === 1 && !normalized.components['does-not-exist']);

console.log(`\nAssistant feature tests: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
