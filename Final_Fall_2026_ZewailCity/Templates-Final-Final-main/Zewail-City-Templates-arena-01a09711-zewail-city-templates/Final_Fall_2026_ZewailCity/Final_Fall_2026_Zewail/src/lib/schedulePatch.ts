import type { Course, Day, Meeting, MeetingType } from '../types';

export const SCHEDULE_CSV_HEADER = 'courseCode,subtype,section,day,start,end,room';
export const SCHEDULE_CSV_LIMIT = 250_000;
export const UNPUBLISHED_ROOM = 'ROOM_UNPUBLISHED';

type FileName = 'courses.json' | 'sch.json';
type PatchRow = { line: number; code: string; type: MeetingType; section: string; day: Day; start: number; end: number; rawStart: string; rawEnd: string; room: string; unpublished: boolean };
export type PatchIssue = { line: number; reason: string; kind: 'duplicate' | 'multiple meetings' | 'conflict' | 'ambiguous' | 'invalid' | 'missing' };
export type PatchChange = { line: number; file: FileName; code: string; component: string; before: string; after: string; sourceTime: string };
export type SchedulePatchReport = {
  read: number; applied: number; unchanged: number; excluded: number;
  issues: PatchIssue[]; changes: PatchChange[]; fatal?: string;
  next: Record<FileName, Course[]>;
};

const days: Record<string, Day> = { sun: 'Sun', sunday: 'Sun', mon: 'Mon', monday: 'Mon', tue: 'Tue', tuesday: 'Tue', wed: 'Wed', wednesday: 'Wed', thu: 'Thu', thursday: 'Thu' };
const pools: Record<MeetingType, 'lectures' | 'labs' | 'tutorials'> = { Lecture: 'lectures', Lab: 'labs', Tutorial: 'tutorials' };
const key = (code: string, type: string, section: string) => `${code.replace(/\s+/g, '').toUpperCase()}|${type.toLowerCase()}|${section}`;
const describe = (meeting: Pick<Meeting, 'day' | 'start' | 'end' | 'room'>) =>
  `${meeting.day} ${String(Math.floor(meeting.start / 60)).padStart(2, '0')}:${String(meeting.start % 60).padStart(2, '0')}–${String(Math.floor(meeting.end / 60)).padStart(2, '0')}:${String(meeting.end % 60).padStart(2, '0')} · ${meeting.room || 'Room not published'}`;

function parseClock(input: string): number | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(input.trim());
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  const ampm = match[3]?.toUpperCase();
  if (minute > 59 || (ampm ? hour < 1 || hour > 12 : hour > 23)) return null;
  return (ampm ? (hour % 12) + (ampm === 'PM' ? 12 : 0) : hour) * 60 + minute;
}

/** Quote-aware CSV reader; preserves strings such as section 01 and rooms with commas. */
function csvRows(input: string): { cells: string[]; line: number }[] {
  const rows: { cells: string[]; line: number }[] = [];
  let fields: string[] = [], field = '', quoted = false, closed = false, line = 1, rowStart = 1;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"' && quoted && input[i + 1] === '"') { field += '"'; i++; }
    else if (char === '"' && quoted) { quoted = false; closed = true; }
    else if (char === '"' && !quoted && !field.trim() && !closed) quoted = true;
    else if (char === '"') throw new Error(`Unexpected quote on CSV line ${line}; no rows were applied.`);
    else if (closed && !quoted && char !== ',' && char !== '\r' && char !== '\n' && !/\s/.test(char)) throw new Error(`Unexpected text after a quoted field on CSV line ${line}; no rows were applied.`);
    else if (char === ',' && !quoted) { fields.push(field); field = ''; closed = false; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      fields.push(field);
      if (fields.some(value => value.trim())) rows.push({ cells: fields, line: rowStart });
      if (char === '\r' && input[i + 1] === '\n') i++;
      line++; rowStart = line; fields = []; field = ''; closed = false;
    } else { if (!closed || quoted) field += char; if (char === '\n') line++; }
  }
  if (quoted) throw new Error('CSV has an unclosed quoted value; no rows were applied.');
  fields.push(field);
  if (fields.some(value => value.trim())) rows.push({ cells: fields, line: rowStart });
  return rows;
}

/** Preview one CSV against both private drafts without mutating them or publishing anything. */
export function previewSchedulePatch(input: string, current: Record<FileName, Course[]>): SchedulePatchReport {
  const next: Record<FileName, Course[]> = { 'courses.json': structuredClone(current['courses.json']), 'sch.json': structuredClone(current['sch.json']) };
  const report: SchedulePatchReport = { next, read: 0, applied: 0, unchanged: 0, excluded: 0, issues: [], changes: [] };
  if (input.length > SCHEDULE_CSV_LIMIT) { report.fatal = `CSV exceeds ${SCHEDULE_CSV_LIMIT.toLocaleString()} characters. Split complete rows into smaller files; no partial import was staged.`; return report; }
  let rows: { cells: string[]; line: number }[];
  try { rows = csvRows(input.replace(/^\uFEFF/, '')); }
  catch (error) { report.fatal = (error as Error).message; return report; }
  const header = rows.shift()?.cells.map(value => value.trim()) ?? [];
  if (header.join(',') !== SCHEDULE_CSV_HEADER) {
    report.fatal = `Expected exactly these columns in this order: ${SCHEDULE_CSV_HEADER}. No changes were staged.`;
    return report;
  }
  report.read = rows.length;
  const rejected = (line: number, reason: string, kind: PatchIssue['kind']) => {
    report.excluded++;
    report.issues.push({ line, reason, kind });
  };
  const grouped = new Map<string, PatchRow[]>();
  const incompleteKeys = new Set<string>();
  for (const { cells, line } of rows) {
    const [code, rawType, section, rawDay, rawStart, rawEnd, rawRoom] = cells.map(value => value.trim());
    const type = (['Lecture', 'Lab', 'Tutorial'] as const).find(value => value.toLowerCase() === rawType?.toLowerCase());
    const rowKey = code && rawType && section ? key(code, rawType, section) : '';
    const invalid = (reason: string) => { if (rowKey) incompleteKeys.add(rowKey); rejected(line, reason, 'invalid'); };
    if (cells.length !== 7 || !code || !type || !section || !days[rawDay?.toLowerCase()] || !rawStart || !rawEnd || rawRoom === undefined) {
      invalid(`Expected 7 complete fields with an existing course, Lecture/Lab/Tutorial, section and Sun–Thu day; got ${cells.length} columns.`);
      continue;
    }
    const start = parseClock(rawStart), end = parseClock(rawEnd);
    if (start === null || end === null || start >= end || end > 1440 || /:59\s*(?:AM|PM)?$/i.test(rawEnd)) {
      invalid(`Invalid or ambiguous time ${rawStart}–${rawEnd}. Use exact 24-hour boundaries (e.g. 10:00,12:00); a displayed :59 end requires verified source semantics.`);
      continue;
    }
    if (!rawRoom) { invalid('Room extraction is missing. Existing room is preserved; use ROOM_UNPUBLISHED only when the official source explicitly says no room is published.'); continue; }
    const unpublished = rawRoom === UNPUBLISHED_ROOM;
    const row: PatchRow = { line, code, type, section, day: days[rawDay.toLowerCase()], start, end, rawStart, rawEnd, room: unpublished ? '' : rawRoom, unpublished };
    const groupKey = key(code, type, section);
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), row]);
  }

  for (const [groupKey, sameSection] of grouped) {
    if (incompleteKeys.has(groupKey)) {
      sameSection.forEach(row => rejected(row.line, 'Another row for this section was incomplete; review the whole section before applying.', 'invalid'));
      continue;
    }
    const variants = new Map<string, PatchRow[]>();
    for (const row of sameSection) {
      const signature = JSON.stringify([row.day, row.start, row.end, row.room, row.unpublished]);
      variants.set(signature, [...(variants.get(signature) ?? []), row]);
    }
    if (variants.size > 1) {
      const first = sameSection[0];
      const contradictory = sameSection.some((a, i) => sameSection.slice(i + 1).some(b =>
        a.day === b.day && a.start < b.end && b.start < a.end));
      const kind = contradictory ? 'conflict' : 'multiple meetings';
      sameSection.forEach(row => rejected(row.line,
        `${first.code} ${first.type} ${first.section} has ${variants.size} different published entries (${kind}); the planner models one meeting per section. All entries require manual review.`, kind));
      continue;
    }
    const [row, ...duplicates] = sameSection;
    duplicates.forEach(duplicate => rejected(duplicate.line, `Identical duplicate of CSV row ${row.line}; ignored.`, 'duplicate'));
    const found = (Object.entries(next) as [FileName, Course[]][]).flatMap(([file, catalog]) =>
      catalog.filter(course => key(course.code, row.type, row.section) === groupKey)
        .map(course => ({ file, course })));
    if (found.length !== 1) {
      rejected(row.line, found.length ? 'Course code appears more than once across courses.json and sch.json; ambiguous.' : `Course ${row.code} does not exist in either dataset.`, found.length ? 'ambiguous' : 'missing');
      continue;
    }
    const { file, course } = found[0];
    const meetings = course.instructors.flatMap(teacher => teacher[pools[row.type]].filter(meeting => meeting.sec === row.section));
    if (meetings.length !== 1) {
      rejected(row.line, meetings.length ? `Section ${row.section} exists ${meetings.length} times across instructor groups; review its instructor manually.` : `Section ${row.section} does not exist for ${course.code} ${row.type}.`, meetings.length ? 'ambiguous' : 'missing');
      continue;
    }
    const meeting = meetings[0], before = describe(meeting);
    const same = meeting.day === row.day && meeting.start === row.start && meeting.end === row.end && meeting.room === row.room;
    if (same) { report.unchanged++; continue; }
    meeting.day = row.day; meeting.start = row.start; meeting.end = row.end; meeting.room = row.room;
    report.applied++;
    report.changes.push({ line: row.line, file, code: course.code, component: `${row.type} ${row.section}`, before, after: describe(meeting), sourceTime: `${row.rawStart}–${row.rawEnd}` });
  }
  return report;
}
