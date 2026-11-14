import { check } from './shared';
import { COURSE_BY_ID } from '../../src/data/courses';
import { DEFAULT_PREFERENCES } from '../../src/lib/preferences';
import { encodeSchedule, decodeSchedule, buildShareUrl, readScheduleFromLocation } from '../../src/data/share';
import { emptyPick, uid, type PickState } from '../../src/lib/picks';
import { optionStates } from '../../src/lib/picks-parts/optionStates';
import { phys } from './p1-basics';
import { report } from './p2-engine';

// Share links: round trip, origins and hostile payloads.
/* ================= 6. share URL roundtrip (instructor filter + prefs must survive) ================= */
export const csai203 = COURSE_BY_ID['csai203'];
export const shareCourses = [csai203, phys, COURSE_BY_ID['csai201']];
export const realPicks: PickState = {};
for (const c of shareCourses) {
  const p = emptyPick();
  const lec = optionStates(c, 'Lecture', shareCourses.filter((x) => x.id !== c.id), realPicks)[0];
  const lab = optionStates(c, 'Lab', shareCourses.filter((x) => x.id !== c.id), realPicks)[0];
  if (lec) p.Lecture = lec.key;
  if (lab) p.Lab = lab.key;
  realPicks[c.id] = p;
}
export const prefsTweaked = { ...DEFAULT_PREFERENCES, goals: { ...DEFAULT_PREFERENCES.goals, earliestFinish: false }, preferredEnd: 960 };
const encoded = encodeSchedule('software', shareCourses, realPicks, {
  requireComplete: true,
  typeFilter: 'Lab',
  courseFilter: 'csai203',
  preferences: prefsTweaked,
  instructorFilter: { csai203: 1, phys104: 0 },
});
check('payload is compact base64url (no + / = chars)', !/[+/=]/.test(encoded) && encoded.length < 400);
const decoded = decodeSchedule(encoded)!;
check('decode: major preserved', decoded.majorId === 'software');
check('decode: every section key preserved', shareCourses.every((c) => decoded.picks[c.id]?.Lecture === realPicks[c.id]?.Lecture && decoded.picks[c.id]?.Lab === realPicks[c.id]?.Lab));
check('decode: instructorFilter survives', decoded.instructorFilter.csai203 === 1 && decoded.instructorFilter.phys104 === 0);
check('decode: browse filters survive', decoded.typeFilter === 'Lab' && decoded.courseFilter === 'csai203');
check('decode: preferences survive', !!decoded.preferences && decoded.preferences.preferredEnd === 960 && decoded.preferences.goals.earliestFinish === false);
check('requireComplete=true roundtrips (default omitted)', decoded.requireComplete === undefined);
check('requireComplete=false survives explicitly', decodeSchedule(encodeSchedule('software', [csai203], realPicks, { requireComplete: false }))!.requireComplete === false);
check('prefs-only link with no picks still decodes', (() => {
  const d = decodeSchedule(encodeSchedule('software', [], {}, { preferences: prefsTweaked, instructorFilter: { csai203: 2 } }));
  return !!d && Object.keys(d.picks).length === 0 && d.preferences?.preferredEnd === 960;
})());

/* ============ 6b. Share URL origin — runtime origin, sandbox artifacts never leak ============ */
{
  const loc = (href: string) => {
    const u = new URL(href);
    return { href, origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash, protocol: u.protocol, host: u.host, port: u.port };
  };
  // The full author state listed in the acceptance criteria.
  const fullPrefs = {
    ...DEFAULT_PREFERENCES,
    goals: { minimizeGaps: true, maximizeFreeDays: true, earliestFinish: false, latestStart: false },
    preferredDays: ['Sun', 'Tue'],
    keepFreeDays: ['Wed'],
    preferredStart: 540,
    preferredEnd: 1020,
    noBefore: 540,
    noBeforeStrict: true,
    noAfter: 1020,
    noAfterStrict: false,
    maxHoursPerDay: 5,
    preferredDaysHard: true,
    keepFreeDaysHard: true,
    timeRangeHard: false,
    maxHoursHard: true,
  };
  const extras = {
    requireComplete: false,
    typeFilter: 'Tutorial',
    courseFilter: 'phys104',
    preferences: fullPrefs,
    instructorFilter: { csai203: 1, phys104: 0 },
  };

  // Vercel production — even with proxy/debug junk and a stale ?schedule= in the address bar.
  globalThis.location = loc('https://zc-planora.vercel.app/?sbx_debug=1&from=arena&schedule=STALEOLD#about');
  const prod = buildShareUrl('software', shareCourses, realPicks, extras);
  check('production URL is exactly app origin + ?schedule= payload', prod.startsWith('https://zc-planora.vercel.app/?schedule='));
  check('no Arena/sandbox debug params leak into the link', !prod.includes('arena') && !prod.includes('sbx_debug') && !prod.includes('STALEOLD') && !prod.includes('#about'));
  check('no personal/private fields in the payload', !/[?&](name|email|token|id(?!entity))=/i.test(prod));

  // "Another device/browser": only the URL string crosses over — decode it fresh.
  const param = new URL(prod).searchParams.get('schedule')!;
  const fresh = decodeSchedule(param)!;
  check('roundtrip: major + every selected course/pick restored', !!fresh && fresh.majorId === 'software' && shareCourses.every((c) => fresh.picks[c.id]?.Lecture === realPicks[c.id]?.Lecture && fresh.picks[c.id]?.Lab === realPicks[c.id]?.Lab));
  check('roundtrip: instructor pins restored', !!fresh && fresh.instructorFilter.csai203 === 1 && fresh.instructorFilter.phys104 === 0);
  check('roundtrip: browse filters restored', !!fresh && fresh.typeFilter === 'Tutorial' && fresh.courseFilter === 'phys104');
  check('roundtrip: requireComplete=false restored', !!fresh && fresh.requireComplete === false);
  check('roundtrip: goals, days, window, no-before, MAX HOURS and HARD flags restored', !!fresh && (() => {
    const pr = fresh.preferences!;
    return Object.keys(fullPrefs).every((k) => JSON.stringify((pr as never)[k]) === JSON.stringify((fullPrefs as never)[k]));
  })());

  // Arena preview keeps ITS runtime origin (works on the sandbox too — nothing hardcoded).
  globalThis.location = loc('https://5173-iqa3yo386zdsl59vp4klb.e2b.app/index.html?x=1');
  check('preview: link uses the preview origin, path preserved', buildShareUrl('software', [csai203], realPicks).startsWith('https://5173-iqa3yo386zdsl59vp4klb.e2b.app/index.html?schedule='));
  // Localhost/dev port preserved.
  globalThis.location = loc('http://localhost:5173/');
  check('localhost: dev port preserved', buildShareUrl('software', [csai203], realPicks).startsWith('http://localhost:5173/?schedule='));
  // Future subpath deployment keeps the app path.
  globalThis.location = loc('https://zewail.example.edu/planner/');
  check('subpath deployment keeps the app path', buildShareUrl('software', [csai203], realPicks).startsWith('https://zewail.example.edu/planner/?schedule='));
  // file:// (opaque "null" origin) must degrade to path + payload, never "nullhttp…" garbage.
  globalThis.location = { href: 'file:///home/user/zw/dist/index.html', origin: 'null', pathname: '/home/user/zw/dist/index.html', search: '', hash: '', protocol: 'file:', host: '', port: '' };
  const fileUrl = buildShareUrl('software', [csai203], realPicks);
  check('file:// origin: path + payload, no literal "null" domain', fileUrl.startsWith('/home/user/zw/dist/index.html?schedule=') && !fileUrl.startsWith('null'));
  // Whatever location remains, the payload itself stays decodable (codec untouched).
  check('payload from any origin still decodes', decodeSchedule(fileUrl.split('?schedule=')[1]) !== null);

  // Best-Schedule card path: a card shares ITS schedule with ITS derived pins.
  {
    const s0 = report.schedules[0];
    const cardPicks: PickState = {};
    s0.perCourse.forEach((e) => {
      const p = emptyPick();
      e.pairing.meetings.forEach((m) => { p[m.type] = uid(m); });
      cardPicks[e.course.id] = p;
    });
    globalThis.location = loc('https://zc-planora.vercel.app/');
    const cardUrl = buildShareUrl('software', s0.perCourse.map((e) => e.course), cardPicks, {
      preferences: DEFAULT_PREFERENCES,
      instructorFilter: Object.fromEntries(s0.perCourse.map((e) => [e.course.id, e.instructorIdx])),
    });
    const back = decodeSchedule(new URL(cardUrl).searchParams.get('schedule')!)!;
    check('card share: exact schedule state + its own instructor grouping survives', (() => {
      const ok = s0.perCourse.every((e) => {
        const p = back.picks[e.course.id];
        return !!p && e.pairing.meetings.every((m) => p[m.type] === uid(m));
      });
      const pins = s0.perCourse.every((e) => back.instructorFilter[e.course.id] === e.instructorIdx);
      return ok && pins;
    })());
  }

  // Corrupt/invalid links still fall back safely after the origin change (readScheduleFromLocation path).
  globalThis.location = loc('https://zc-planora.vercel.app/?schedule=%25%25garbage%25%25');
  check('garbage schedule param on production host => readScheduleFromLocation null, no throw', readScheduleFromLocation() === null);
}

/* hostile payloads must fail safe, never throw */
check('garbage string => null', decodeSchedule('not-base64!!') === null);
check('valid base64 of junk => null', decodeSchedule(btoa('{"v":3}')) === null);
check('unknown major => null', decodeSchedule(btoa(JSON.stringify({ v: 3, m: 'nonsense-major', r: [] }))) === null);
check('empty string => null', decodeSchedule('') === null);
check('stale ids dropped row-by-row without breaking siblings', (() => {
  const d = decodeSchedule(btoa(JSON.stringify({ v: 3, m: 'software', r: [['ghost999', 0, 0, 0], ['csai203', 9999, 0, -3], ['phys104', 0, 0, 0]], inf: [['csai203', 42], ['ghost999', 1], ['phys104', 'x']] })));
  return (
    !!d &&
    !d.picks.ghost999 &&
    Object.keys(d.instructorFilter).length === 0 &&
    d.picks.csai203?.Lecture == null &&
    d.picks.csai203?.Lab === optionStates(csai203, 'Lab', [], {}, {})[0].key &&
    d.picks.phys104?.Lecture != null
  );
})());
