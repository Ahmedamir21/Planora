import { uid, type PickState } from '../../lib/picks';
import { type GeneratedSchedule } from '../../lib/bestSchedule';

export function picksFromSchedule(schedule: GeneratedSchedule): PickState {
  const out: PickState = {};
  schedule.perCourse.forEach(({ course, pairing }) => {
    out[course.id] = {
      Lecture: pairing.lecture ? uid(pairing.lecture) : null,
      Lab: pairing.labs[0] ? uid(pairing.labs[0]) : null,
      Tutorial: pairing.tutorials[0] ? uid(pairing.tutorials[0]) : null,
    };
  });
  return out;
}
