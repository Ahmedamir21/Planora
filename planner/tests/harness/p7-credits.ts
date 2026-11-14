import { check } from './shared';
import { COURSES } from '../../src/data/courses';
import { effectiveCreditCap, isValidCreditCap, registeredCredits, wouldExceedCap } from '../../src/data/appState';
import { emptyPick, type PickState } from '../../src/lib/picks';

// Credit cap rules.
/* ================= 13. credit-cap enforcement (Part 4) ================= */
{
  check('valid caps are exactly 13/18/21 and nothing else', isValidCreditCap(13) && isValidCreditCap(18) && isValidCreditCap(21) && !isValidCreditCap(22) && !isValidCreditCap('18') && !isValidCreditCap(null));
  check('effective cap defaults to 21 and can never exceed 21', effectiveCreditCap(null) === 21 && effectiveCreditCap(undefined) === 21 && effectiveCreditCap(13) === 13 && effectiveCreditCap(21) === 21);
  const p3: PickState = { csai201: emptyPick(), csai202: emptyPick(), csai205: emptyPick(), math105: emptyPick() }; // 12 credits
  check('registeredCredits sums real credit values', registeredCredits(p3) === 12);
  check('13-cap blocks the 4th→5th 3-credit course (12+3 > 13)', wouldExceedCap(p3, 'it205', 13) === true);
  check('18-cap allows it (12+3 <= 18)', wouldExceedCap(p3, 'it205', 18) === false);
  check('unchosen tier = 21-cap ceiling still enforced', (() => {
    const selected: PickState = {};
    let total = 0;
    let candidate: string | null = null;
    for (const course of COURSES.filter((course) => (course.credits ?? 0) > 0)) {
      const credits = course.credits ?? 0;
      if (total + credits <= 21) {
        selected[course.id] = emptyPick();
        total += credits;
      } else if (!candidate) {
        candidate = course.id;
      }
    }
    if (!candidate || total === 0) return false;
    return wouldExceedCap(selected, candidate, null) === true && registeredCredits(selected) === total && total <= 21;
  })());
  check('already-registered course never blocked (removal always allowed)', wouldExceedCap(p3, 'csai201', 13) === false);
  check('1-credit placeholder fits where a 3-credit course would not', (() => {
    const p: PickState = {};
    ['csai201', 'csai202', 'csai205', 'math105'].forEach((id) => { p[id] = emptyPick(); }); // 12 credits
    return wouldExceedCap(p, 'csai498', 13) === false && wouldExceedCap(p, 'it205', 13) === true;
  })());
}
