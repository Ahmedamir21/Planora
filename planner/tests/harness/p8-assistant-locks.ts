import { check } from './shared';
import { COURSE_BY_ID } from '../../src/data/courses';
import { buildCoursePairings } from '../../src/lib/scheduler-parts/pairings';
import { uid } from '../../src/lib/picks';

// Assistant lock regression.
/* ================= Assistant locks regression ================= */
{
  const { pairingMatchesLockedPick } = await import('../../src/lib/assistantControls');
  const math = COURSE_BY_ID['math105'];
  const pairings = buildCoursePairings(math);
  const sec3 = pairings.find((p) => p.lecture?.sec === '03');
  check('MATH 105 has Lecture Sec 03 available for lock tests', Boolean(sec3?.lecture));
  if (sec3?.lecture) {
    const key = uid(sec3.lecture);
    check(
      'locked Lecture Sec 03 only matches pairings that preserve that exact lecture',
      pairings.filter((p) => pairingMatchesLockedPick(p, { Lecture: key })).every((p) => p.lecture && uid(p.lecture) === key),
    );
  }
}
