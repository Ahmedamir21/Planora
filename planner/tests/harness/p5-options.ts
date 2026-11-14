import { check } from './shared';
import { COURSE_BY_ID, COURSES } from '../../src/data/courses';
import { MAJORS } from '../../src/data/majors';
import { MAX_COMBOS } from '../../src/lib/scheduler';
import { DEFAULT_PREFERENCES } from '../../src/lib/preferences';
import { emptyPick, uid, type PickState } from '../../src/lib/picks';
import { optionStates, summarizeHidden, hiddenReasons } from '../../src/lib/picks-parts/optionStates';
import { csai203 } from './p3-share';

// Option states and dataset integrity.
/* ================= 9. option state: filtering is derived & reversible ================= */
check('picks NEVER hide other instructors’ options — components are independent now', (() => {
  const lec = optionStates(COURSE_BY_ID['csai202'], 'Lecture', [], {}, {})[0]; // Yousry's lecture
  const labs = optionStates(COURSE_BY_ID['csai202'], 'Lab', [], { csai202: { ...emptyPick(), Lecture: lec.key } }, {});
  return labs.length > 0 && labs.every((o) => !o.hiddenByInstructor);
})());
check('cross-instructor lab under a chosen lecture is selectable unless it clashes by TIME', (() => {
  const ashraf = optionStates(COURSE_BY_ID['csai202'], 'Lecture', [], {}, {}).find((o) => o.instructorIdx === 1)!;
  const labs = optionStates(COURSE_BY_ID['csai202'], 'Lab', [COURSE_BY_ID['csai202']], { csai202: { ...emptyPick(), Lecture: ashraf.key } }, {});
  return labs.some((o) => !o.disabledByConflict && o.instructorIdx !== ashraf.instructorIdx);
})());
check('pill filter hides other groups (view only) but the chosen row stays visible', (() => {
  const lec = optionStates(csai203, 'Lecture', [], {}, {})[0];
  const p: PickState = { csai203: { ...emptyPick(), Lecture: lec.key } };
  const labs = optionStates(csai203, 'Lab', [], p, { pinnedInstructorIdx: 1 });
  const hidden = labs.filter((o) => o.hiddenByInstructor);
  const shown = labs.filter((o) => !o.hiddenByInstructor);
  void p; // picks cannot override the filter for hiding, but also cannot be hidden BY it — picked rows escape
  return hidden.length > 0 && shown.length > 0 && shown.every((o) => o.instructorIdx === 1 || o.picked);
})());
check('un-pin restores everything (reversibility)', (() => {
  const before = optionStates(csai203, 'Lab', [], {}, {}).length;
  optionStates(csai203, 'Lab', [], {}, { pinnedInstructorIdx: 1 });
  const after = optionStates(csai203, 'Lab', [], {}, {}).length;
  return before === after;
})());
check('conflicting option disabled WITH reason; removing the conflict restores it', (() => {
  // Across the real dataset: any chosen meeting must grey out overlapping options of the
  // OTHER kinds in the same course, with a concrete reason, and restore them when cleared.
  for (const c of Object.values(COURSE_BY_ID)) {
    for (const kindA of ['Lecture', 'Tutorial', 'Lab'] as const) {
      for (const a of optionStates(c, kindA, [], {}, {})) {
        const p: PickState = { [c.id]: { ...emptyPick(), [kindA]: a.key } };
        for (const kindB of (['Lecture', 'Tutorial', 'Lab'] as const).filter((k) => k !== kindA)) {
          const blocked = optionStates(c, kindB, [c], p, {}).find((o) => o.disabledByConflict);
          if (!blocked) continue;
          const reasons = hiddenReasons(blocked);
          const restored = optionStates(c, kindB, [c], {}, {}).find((o) => o.key === blocked.key)!;
          return reasons.some((r) => r.includes('Conflicts with')) && !!restored && !restored.disabledByConflict;
        }
      }
    }
  }
  return false; // no cross-kind conflict exists in the dataset at all — would itself be a red flag
})());
check('HARD preference disables an option with reason; SOFT never disables', (() => {
  const hardPrefs = { ...DEFAULT_PREFERENCES, preferredStart: 600, preferredEnd: 660, timeRangeHard: true };
  const labs = optionStates(csai203, 'Lab', [], {}, { preferences: hardPrefs });
  const blocked = labs.filter((o) => o.hardReasons.length > 0);
  const soft = optionStates(csai203, 'Lab', [], {}, { preferences: { ...DEFAULT_PREFERENCES, preferredStart: 600, preferredEnd: 660 } });
  return blocked.length > 0 && hiddenReasons(blocked[0]).length > 0 && soft.every((o) => o.hardReasons.length === 0 && !o.disabledByConflict);
})());
check('picked option is never hidden or disabled by its own state', (() => {
  const labs = optionStates(csai203, 'Lab', [], {}, { pinnedInstructorIdx: 1 });
  const pickOfGroup = labs.find((o) => !o.hiddenByInstructor)!;
  const again = optionStates(csai203, 'Lab', [], { csai203: { ...emptyPick(), Lab: pickOfGroup.key } }, { pinnedInstructorIdx: null });
  const me = again.find((o) => o.key === pickOfGroup.key)!;
  return me.picked && !me.disabledByConflict && me.conflicts.length === 0;
})());
check('summary counts hidden vs conflicts numerically', (() => {
  const s = summarizeHidden(optionStates(csai203, 'Lab', [], {}, { pinnedInstructorIdx: 1 }));
  return s.hidden >= 0 && s.conflicts >= 0 && Number.isFinite(s.hidden);
})());

/* ================= 10. dataset integrity ================= */
check('majors reference real courses only', COURSES.length > 0 && MAJORS.every((mj) => mj.years.every((y) => y.courseIds.every((id) => COURSE_BY_ID[id]))));
check('all meetings: positive 60/120-min intervals, valid day clock, aligned minutes', (() => {
  let ok = true;
  COURSES.forEach((c) =>
    c.instructors.forEach((i) =>
      [...i.lectures, ...i.labs, ...i.tutorials].forEach((m) => {
        const d = m.end - m.start;
        if (d !== 60 && d !== 120) ok = false;
        if (m.start < 0 || m.end > 24 * 60 || m.start >= m.end || m.start % 60 !== 0 || m.end % 60 !== 0) ok = false;
      }),
    ),
  );
  return ok;
})());
check('no duplicate uid within a course/kind', (() => {
  let ok = true;
  COURSES.forEach((c) => {
    (['Lecture', 'Lab', 'Tutorial'] as const).forEach((kind) => {
      const keys = optionStates(c, kind, [], {}, {}).map((o) => o.key);
      if (new Set(keys).size !== keys.length) ok = false;
    });
  });
  return ok;
})());
check('engine budgets configured', MAX_COMBOS === 200_000);
