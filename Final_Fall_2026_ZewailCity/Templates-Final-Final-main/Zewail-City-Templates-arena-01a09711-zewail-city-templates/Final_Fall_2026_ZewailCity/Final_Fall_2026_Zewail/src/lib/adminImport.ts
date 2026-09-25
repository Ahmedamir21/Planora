import type { Course, Day, Instructor, Meeting, MeetingType } from '../types';

export type ImportRow = { courseCode: string; subtype: MeetingType; section: string; day: Day; start: number; end: number; room: string; instructor: string };
export type ImportResult = { rows: ImportRow[]; warnings: string[] };

const days: Record<string, Day> = { sun: 'Sun', sunday: 'Sun', mon: 'Mon', monday: 'Mon', tue: 'Tue', tuesday: 'Tue', wed: 'Wed', wednesday: 'Wed', thu: 'Thu', thursday: 'Thu' };
const groups: Record<MeetingType, 'lectures' | 'labs' | 'tutorials'> = { Lecture: 'lectures', Lab: 'labs', Tutorial: 'tutorials' };
const normalized = (value: string) => value.replace(/\s+/g, '').toUpperCase();

function clock(value: string, inclusiveEnd = false): number | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]), meridiem = match[3]?.toUpperCase();
  if (minute > 59 || (meridiem ? hour < 1 || hour > 12 : hour > 23)) return null;
  const result = (meridiem ? (hour % 12) + (meridiem === 'PM' ? 12 : 0) : hour) * 60 + minute;
  return result + (inclusiveEnd && minute === 59 ? 1 : 0);
}

function makeRow(fields: string[], location: string, inclusiveEnd = false): ImportRow | string {
  const [courseCode, rawType, rawSection, rawDay, rawStart, rawEnd, room, instructor] = fields.map(value => value.trim());
  const subtype = (['Lecture', 'Lab', 'Tutorial'] as const).find(value => value.toLowerCase() === rawType?.toLowerCase());
  const day = days[rawDay?.toLowerCase()];
  const start = clock(rawStart || ''); const end = clock(rawEnd || '', inclusiveEnd);
  if (!courseCode || !subtype || !rawSection || !day || start === null || end === null || start >= end || end > 1440 || !instructor)
    return `${location}: missing/invalid course, component, section, day, time or instructor; skipped.`;
  return { courseCode, subtype, section: rawSection, day, start, end, room: room || '', instructor };
}

function csvRows(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], value = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"' && quoted && input[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(value); if (row.some(cell => cell.trim())) rows.push(row);
      row = []; value = '';
    } else value += char;
  }
  if (quoted) throw new Error('CSV has an unclosed quote.');
  row.push(value); if (row.some(cell => cell.trim())) rows.push(row);
  return rows;
}

/** Only explicit, complete Self-Service fields are imported. Unknown fragments are never guessed. */
export function parseAdminImport(input: string, selectedCourseCode = '', format: 'auto' | 'csv' | 'paste' = 'auto'): ImportResult {
  const warnings: string[] = [], rows: ImportRow[] = [];
  if (input.length > 250_000) return { rows, warnings: ['Input exceeds 250 KB. Split it into smaller imports.'] };
  const trimmed = input.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return { rows, warnings: ['Paste Self-Service results or choose a CSV file first.'] };
  const looksLikeCsv = /^"?course\s*code"?\s*,/i.test(trimmed);
  if (format === 'csv' || (format === 'auto' && looksLikeCsv)) {
    let table: string[][];
    try { table = csvRows(trimmed); } catch (error) { return { rows, warnings: [(error as Error).message] }; }
    const header = table.shift()!.map(cell => cell.trim().replace(/\s+/g, '').toLowerCase());
    const names = ['coursecode', 'subtype', 'section', 'day', 'start', 'end', 'room', 'instructor'];
    if (names.some(name => !header.includes(name)) || new Set(header).size !== header.length) return { rows, warnings: ['CSV needs one header for each field: courseCode,subtype,section,day,start,end,room,instructor.'] };
    table.forEach((cells, index) => {
      if (cells.length !== header.length) { warnings.push(`CSV row ${index + 2}: expected ${header.length} columns, found ${cells.length}; skipped.`); return; }
      const result = makeRow(names.map(name => cells[header.indexOf(name)] ?? ''), `CSV row ${index + 2}`);
      if (typeof result === 'string') warnings.push(result); else rows.push(result);
    });
  } else {
    // Self-Service copy includes course headings plus repeated Subtype/Section result blocks.
    const heading = /(?:^|\n)\s*([A-Z]{2,}\s*\d{2,4})\s*:\s*[^\n]+/g;
    const sections = [...trimmed.matchAll(/Subtype:\s*(Lecture|Lab|Tutorial)\s*\|\s*Section:\s*([^\n|]+)/gi)];
    sections.forEach((section, index) => {
      const beginning = section.index ?? 0;
      const preceding = trimmed.slice(0, beginning);
      const headings = [...preceding.matchAll(heading)];
      const found = headings[headings.length - 1];
      const courseCode = found?.[1] || selectedCourseCode;
      const block = trimmed.slice(beginning, sections[index + 1]?.index ?? trimmed.length);
      const time = block.match(/(?:^|\n)\s*(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)\s*(?:\n|$)/i);
      const day = block.match(/(?:^|\n)\s*(Sunday|Monday|Tuesday|Wednesday|Thursday)\s*(?:\n|$)/i);
      const location = block.match(/(?:^|\n)[^\n]*\bRoom\s+([^\n]+)(?:\n|$)/i);
      const afterLocation = (location ? block.slice(block.indexOf(location[0]) + location[0].length) : day ? block.slice(block.indexOf(day[0]) + day[0].length) : '').trim();
      const instructor = afterLocation.split('\n').map(line => line.trim()).find(line => /^(?:Instructor(?:s)?\s*:\s*)?[\p{L}][\p{L} .'\-]{2,}$/u.test(line) && !/^(?:Credits|Seats Left|Year|Subtype|Type|Duration|Schedule|Registration|Course Description|Monday|Tuesday|Wednesday|Thursday|Sunday)\b/i.test(line))?.replace(/^Instructors?\s*:\s*/i, '') || '';
      const result = makeRow([courseCode, section[1], section[2], day?.[1] || '', time?.[1] || '', time?.[2] || '', location?.[1] || '', instructor], `Result ${index + 1}`, true);
      if (typeof result === 'string') warnings.push(result); else rows.push(result);
    });
    if (!sections.length) warnings.push('No Self-Service Subtype/Section results found. Check the copied text or use CSV.');
  }
  // A duplicate may disagree about the actual time or room. Never select one silently.
  const key = (row: ImportRow) => `${normalized(row.courseCode)}|${row.subtype}|${row.section.trim().toUpperCase()}`;
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) || 0) + 1);
  const unique = rows.filter(row => {
    if (counts.get(key(row)) === 1) return true;
    warnings.push(`${row.courseCode} ${row.subtype} ${row.section}: duplicate in this import; all copies skipped. Check Self-Service before editing.`);
    return false;
  });
  return { rows: unique, warnings };
}

export function applyAdminImport(courses: Course[], rows: ImportRow[]): { courses: Course[]; warnings: string[]; applied: number } {
  const result: Course[] = structuredClone(courses), warnings: string[] = [];
  let applied = 0;
  for (const [index, row] of rows.entries()) {
    const matches = result.filter(course => normalized(course.code) === normalized(row.courseCode));
    if (matches.length !== 1) { warnings.push(`Row ${index + 1}: ${row.courseCode} is not a unique course in this draft; skipped.`); continue; }
    const course = matches[0];
    const list = groups[row.subtype];
    const prior = course.instructors.flatMap(teacher => teacher[list].filter(meeting => meeting.sec === row.section));
    if (prior.length > 1) { warnings.push(`Row ${index + 1}: ${course.code} ${row.subtype} ${row.section} is ambiguous; edit it manually.`); continue; }
    let teacher = course.instructors.find(value => value.name.trim().toLowerCase() === row.instructor.toLowerCase());
    if (!teacher) {
      teacher = { name: row.instructor, unassigned: /^(?:instructor\s+not\s+assigned|tba)$/i.test(row.instructor) || undefined, lectures: [], labs: [], tutorials: [] } satisfies Instructor;
      course.instructors.push(teacher);
    }
    for (const instructor of course.instructors) instructor[list] = instructor[list].filter(meeting => meeting.sec !== row.section);
    const meeting: Meeting = { type: row.subtype, sec: row.section, day: row.day, start: row.start, end: row.end, room: row.room };
    teacher[list].push(meeting);
    applied++;
    if (!row.room) warnings.push(`Row ${index + 1}: room is unpublished. Review before saving.`);
  }
  return { courses: result, warnings, applied };
}

export function describeDraftChanges(before: string, after: string): string[] {
  let previous: unknown, next: unknown;
  try { previous = JSON.parse(before); next = JSON.parse(after); } catch { return ['JSON is invalid; fix it before reviewing.']; }
  const changes: string[] = [];
  if (Array.isArray(previous) && Array.isArray(next)) {
    const old = new Map(previous.map((item: { id: string }) => [item.id, item]));
    for (const item of next as Array<{ id: string; code?: string; instructors?: Instructor[] }>) {
      const prior = old.get(item.id) as typeof item | undefined;
      if (!prior) { changes.push(`${item.code || item.id}: added`); continue; }
      for (const field of ['code', 'name', 'credits', 'group', 'noFixedSchedule'] as const) {
        const oldValue = (prior as Record<string, unknown>)[field], newValue = (item as Record<string, unknown>)[field];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) changes.push(`${item.code || item.id} ${field}: ${String(oldValue ?? '(blank)')} → ${String(newValue ?? '(blank)')}`);
      }
      if (item.instructors && prior.instructors) {
        const flatten = (value: typeof item) => (value.instructors || []).flatMap(teacher => (['lectures', 'labs', 'tutorials'] as const).flatMap(group => teacher[group].map(meeting => ({ key: `${meeting.type} ${meeting.sec}`, detail: `${teacher.name} · ${meeting.day} ${meeting.start}–${meeting.end} · ${meeting.room || 'Room not published'}` }))));
        const oldMeetings = new Map(flatten(prior).map(value => [value.key, value.detail]));
        const newMeetings = new Map(flatten(item).map(value => [value.key, value.detail]));
        for (const key of new Set([...oldMeetings.keys(), ...newMeetings.keys()])) if (oldMeetings.get(key) !== newMeetings.get(key)) changes.push(`${item.code || item.id} ${key}: ${oldMeetings.get(key) || '(not published)'} → ${newMeetings.get(key) || '(removed)'}`);
      } else if (JSON.stringify(prior) !== JSON.stringify(item)) changes.push(`${item.code || item.id}: metadata or year mapping changed`);
    }
    for (const item of previous as Array<{ id: string; code?: string }>) if (!next.some((candidate: { id: string }) => candidate.id === item.id)) changes.push(`${item.code || item.id}: removed`);
  } else if (previous && next && typeof previous === 'object' && typeof next === 'object') {
    for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) if (JSON.stringify((previous as Record<string, unknown>)[key]) !== JSON.stringify((next as Record<string, unknown>)[key])) changes.push(`${key}: ${JSON.stringify((previous as Record<string, unknown>)[key])} → ${JSON.stringify((next as Record<string, unknown>)[key])}`);
  }
  return changes;
}
