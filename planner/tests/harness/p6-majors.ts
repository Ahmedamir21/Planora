import { check, base64UrlEncodeShim } from './shared';
import { COURSE_BY_ID, COURSES } from '../../src/data/courses';
import { MAJORS, allYearCourseIds, yearBadgeOf, yearPlanOf } from '../../src/data/majors';
import { isValidYearId } from '../../src/data/stateValidation';
import { generateBestSchedules } from '../../src/lib/bestSchedule';
import { DEFAULT_PREFERENCES } from '../../src/lib/preferences';
import { encodeSchedule, decodeSchedule } from '../../src/data/share';
import { loadAppState, saveAppState } from '../../src/data/appState';
import { emptyPick, publishedKinds, type PickState } from '../../src/lib/picks';
import { csai203 } from './p3-share';
import { pickIssues } from '../../src/lib/picks-parts/issues';
import { saved } from './p4-storage';

// Year-scoped majors and placeholder courses.
/* ================= 11. year-scoped majors (Part 2) ================= */
check('every major offers its published years in order', MAJORS.every((mj) =>
  mj.years.length === 4 &&
  mj.years[0].id === 'y1' && mj.years[0].label === 'Year 1 (Freshman)' &&
  mj.years[1].id === 'y2' && mj.years[1].label === 'Year 2 (Sophomore)' &&
  mj.years[2].id === 'y3' && mj.years[2].label === 'Year 3 (Junior)' &&
  mj.years[3].id === 'y4' && mj.years[3].label === 'Year 4 (Senior)'));
check('Year 2 lists keep the current five-course major plans', (() => {
  const y2 = (id: string) => MAJORS.find((m) => m.id === id)!.years.find((year) => year.id === 'y2')!.courseIds.join(',');
  return (
    y2('it') === 'csai201,csai202,math105,csai205,it205' &&
    y2('dsai') === 'csai201,csai202,math105,csai205,dsai203' &&
    y2('software') === 'csai201,csai202,csai203,phys104,math105'
  );
})());
check('shared ids referenced, never duplicated (csai203/csai301/csai498 are single courses)', (() => {
  const ids = COURSES.map((c) => c.id);
  return new Set(ids).size === ids.length &&
    ['it', 'dsai'].every((m) => MAJORS.find((x) => x.id === m)!.years.find((y) => y.id === 'y3')!.courseIds.includes('csai203')) &&
    ['it', 'dsai', 'software'].every((m) => MAJORS.find((x) => x.id === m)!.years.some((y) => y.courseIds.includes('csai301'))) &&
    ['it', 'dsai', 'software'].every((m) => MAJORS.find((x) => x.id === m)!.years.find((y) => y.id === 'y4')!.courseIds.includes('csai498'));
})());
check('yearPlanOf falls back to the first year for unknown/absent ids', (() => {
  const mj = MAJORS[0];
  return yearPlanOf(mj, 'y3').id === 'y3' && yearPlanOf(mj, null).id === mj.years[0].id && yearPlanOf(mj, 'zzz').id === mj.years[0].id;
})());
check('allYearCourseIds spans every year of the major (cross-year browser source)', (() => {
  const ids = allYearCourseIds(MAJORS.find((m) => m.id === 'dsai')!);
  return ids.includes('csai201') && ids.includes('dsai307') && ids.includes('dsai456') && new Set(ids).size === ids.length;
})());
check('yearBadgeOf labels a course by its home year', (() => {
  const dsai = MAJORS.find((m) => m.id === 'dsai')!;
  return yearBadgeOf(dsai, 'csai201') === 'Year 2' && yearBadgeOf(dsai, 'dsai307') === 'Year 3' && yearBadgeOf(dsai, 'dsai402') === 'Year 4' && yearBadgeOf(dsai, 'nope') === null;
})());
check('isValidYearId accepts only y1/y2/y3/y4', isValidYearId('y1') && isValidYearId('y2') && isValidYearId('y3') && isValidYearId('y4') && !isValidYearId('y5') && !isValidYearId(2) && !isValidYearId(null));

/* year id in the share codec: v4 roundtrips, v3 (yearless) still decodes */
{
  const withYear = decodeSchedule(encodeSchedule('dsai', [], {}, { yearId: 'y3' }))!;
  check('share codec: yearId roundtrips', withYear.yearId === 'y3');
  const noYear = decodeSchedule(encodeSchedule('dsai', [], {}))!;
  check('share codec: link without a year decodes with yearId undefined (defaults later)', noYear.yearId === undefined);
  // Simulated OLD v3 payload (exact old shape) must still decode.
  const legacy = base64UrlEncodeShim(JSON.stringify({ v: 3, m: 'software', r: [] }));
  const dec = decodeSchedule(legacy);
  check('share codec: legacy v3 payload still decodes', !!dec && dec.majorId === 'software' && dec.yearId === undefined);
  const badYear = decodeSchedule(base64UrlEncodeShim(JSON.stringify({ v: 4, m: 'software', r: [], y: 'y9' })));
  check('share codec: junk year id dropped, not applied', !!badYear && badYear.yearId === undefined);
  const wrongTerm = decodeSchedule(base64UrlEncodeShim(JSON.stringify({ v: 5, t: 'future-term-test', m: 'software', r: [] })));
  check('share codec: another semester is rejected instead of mapped onto current data', wrongTerm === null);
}

/* yearId + creditCap persistence & corruption tolerance */
{
  saveAppState({ ...saved, yearId: 'y4', creditCap: 18 });
  const l = loadAppState()!;
  check('appState: yearId + creditCap roundtrip', l.yearId === 'y4' && l.creditCap === 18);
  localStorage.setItem('zw-app-state-v2', JSON.stringify({ majorId: 'software', picks: {}, instructorFilter: {}, yearId: 'y7', creditCap: 99 }));
  const junky = loadAppState()!;
  check('appState: junk yearId/creditCap dropped to null', junky.yearId === null && junky.creditCap === null);
  localStorage.setItem('zw-app-state-v2', JSON.stringify({ majorId: 'software', picks: {}, instructorFilter: {} }));
  const legacyState = loadAppState()!;
  check('appState: pre-year saved state loads with null year (defaults to first year later)', legacyState.yearId === null && legacyState.creditCap === null);
  localStorage.setItem('zw-app-state-v2', JSON.stringify({ semesterKey: 'future-term-test', majorId: 'software', picks: {}, instructorFilter: {} }));
  check('appState: another semester is rejected instead of restored into current data', loadAppState() === null);
}

/* ================= 12. no-fixed-schedule placeholder courses (Part 1b) ================= */
{
  const placeholders = COURSES.filter((course) => course.noFixedSchedule);
  const senior = COURSE_BY_ID['csai498'];
  check('at least one noFixedSchedule course exists and Senior Project remains one', placeholders.length > 0 && senior?.noFixedSchedule === true && senior.credits === 1);
  check('all noFixedSchedule courses publish ZERO meetings (never invented)', placeholders.every((course) =>
    course.instructors.every((i) => i.lectures.length === 0 && i.labs.length === 0 && i.tutorials.length === 0)));
  check('publishedKinds is empty for every noFixedSchedule course', placeholders.every((course) => publishedKinds(course).length === 0));
  const placeholderPicks: PickState = Object.fromEntries(placeholders.map((course) => [course.id, emptyPick()]));
  check('noFixedSchedule courses raise no pick issues (never "still to decide")', pickIssues(placeholders, placeholderPicks, true).length === 0);
  const rep = generateBestSchedules([COURSE_BY_ID['csai201'], senior], DEFAULT_PREFERENCES);
  check('best-schedule: placeholder never blocks generation and contributes only credits', rep.schedules.length > 0 && rep.noSections.length === 0 &&
    rep.schedules.every((s) => s.perCourse.length === 2 && s.credits === 4 && s.perCourse.some((e) => e.course.id === 'csai498' && e.pairing.meetings.length === 0)));
}
