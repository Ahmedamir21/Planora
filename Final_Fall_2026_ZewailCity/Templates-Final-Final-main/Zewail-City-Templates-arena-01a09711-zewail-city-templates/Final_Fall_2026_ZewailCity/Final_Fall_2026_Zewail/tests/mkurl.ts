// @ts-expect-error shim
globalThis.window = globalThis;
import { COURSE_BY_ID } from '../src/data/courses';
import { encodeSchedule } from '../src/lib/share';
import { emptyPick, optionStates, type PickState } from '../src/lib/picks';
import { DEFAULT_PREFERENCES } from '../src/lib/preferences';
const courses = [COURSE_BY_ID['csai203'], COURSE_BY_ID['phys104'], COURSE_BY_ID['csai201']];
const picks: PickState = {};
for (const c of courses) {
  const p = emptyPick();
  const lec = optionStates(c, 'Lecture', [], picks)[0];
  const lab = optionStates(c, 'Lab', [c], { ...picks, [c.id]: p })[0];
  if (lec) p.Lecture = lec.key;
  if (lab) p.Lab = lab.key;
  picks[c.id] = p;
}
const prefs = {
  ...DEFAULT_PREFERENCES,
  preferredDays: ['Sun', 'Tue'],
  keepFreeDays: ['Wed'],
  preferredStart: null,
  preferredEnd: 1020,
  maxHoursPerDay: 5,
  maxHoursHard: true,
  keepFreeDaysHard: true,
};
console.log(encodeSchedule('software', courses, picks, { requireComplete: true, typeFilter: 'Lab', preferences: prefs, instructorFilter: { csai203: 0 } }));
