import type { Course, Instructor, Meeting } from '../types';
import { csvRows, SCHEDULE_CSV_LIMIT, UNPUBLISHED_ROOM } from './schedulePatch';
import { parseAdminImport } from './adminImport';

export const ENGLISH_CSV_HEADER = 'courseCode,courseName,credits,subtype,section,day,start,end,room,instructor';
const englishCodes = new Set(['ENGL 003', 'ENGL 004', 'ENGL 156', 'ENGL 157']);
const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
type SourceRow = { line: number; code: string; name: string; credits: number; data: string[] };
export type EnglishImportReport = { read: number; applied: number; rejected: string[]; changes: string[]; next: Course[]; fatal?: string };

/** Verified English metadata plus sections; other courses are never changed. */
export function previewEnglishImport(input: string, courses: Course[]): EnglishImportReport {
  const next = structuredClone(courses);
  const report: EnglishImportReport = { read: 0, applied: 0, rejected: [], changes: [], next };
  if (input.length > SCHEDULE_CSV_LIMIT) { report.fatal = 'CSV exceeds 250,000 characters; no rows were staged.'; return report; }
  let rows: ReturnType<typeof csvRows>;
  try { rows = csvRows(input.replace(/^\uFEFF/, '')); }
  catch (cause) { report.fatal = (cause as Error).message; return report; }
  if (rows.shift()?.cells.map(s => s.trim()).join(',') !== ENGLISH_CSV_HEADER) {
    report.fatal = `Expected ${ENGLISH_CSV_HEADER} in this order.`; return report;
  }
  report.read = rows.length;
  const byCode = new Map<string, SourceRow[]>();
  const rejectedCodes = new Set<string>();
  for (const { cells, line } of rows) {
    const [code, name, rawCredits, subtype, section, day, start, end, room, instructor] = cells.map(s => s.trim());
    const credits = Number(rawCredits);
    if (cells.length !== 10 || !englishCodes.has(code) || !name || name === code || !rawCredits || !Number.isFinite(credits) || credits < 0 || credits > 21 || !subtype || !section || !day || !start || !end || !room || !instructor || /^multiple instructors$/i.test(instructor) || /:59\s*(?:AM|PM)?$/i.test(end)) {
      if (englishCodes.has(code)) rejectedCodes.add(code);
      report.rejected.push(`CSV line ${line}: missing/unsupported code, official name, total credits, section, exact time, room or instructor; or ambiguous :59 end.`);
      continue;
    }
    const group = byCode.get(code) || [];
    group.push({ line, code, name, credits, data: [code, subtype, section, day, start, end, room === UNPUBLISHED_ROOM ? '' : room, instructor] });
    byCode.set(code, group);
  }
  for (const [code, entries] of byCode) {
    if (rejectedCodes.has(code)) { report.rejected.push(`${code}: some rows failed validation; all its rows were held for review.`); continue; }
    if (new Set(entries.map(row => `${row.name}|${row.credits}`)).size !== 1) { report.rejected.push(`${code}: conflicting course titles or total credits; held for review.`); continue; }
    const targets = next.filter(course => course.code === code);
    if (targets.length !== 1 || !targets[0].awaitingSource || targets[0].instructors.length) { report.rejected.push(`${code}: expected exactly one empty English shell; existing published sections cannot be replaced.`); continue; }
    const transformed = `${['courseCode','subtype','section','day','start','end','room','instructor'].join(',')}\n${entries.map(row => row.data.map(quote).join(',')).join('\n')}`;
    const parsed = parseAdminImport(transformed, '', 'csv');
    const blocking = parsed.warnings.filter(warning => !warning.includes('identical repeated row ignored'));
    if (blocking.length || !parsed.rows.length) { report.rejected.push(...blocking.map(warning => `${code}: ${warning}`)); continue; }
    const target = targets[0], groupByName = new Map<string, Instructor>();
    for (const row of parsed.rows) {
      const identity = row.instructor.toLocaleLowerCase();
      let instructor = groupByName.get(identity);
      if (!instructor) {
        instructor = { name: row.instructor, unassigned: /^(?:instructor\s+not\s+assigned|tba)$/i.test(row.instructor) || undefined, lectures: [], labs: [], tutorials: [] };
        groupByName.set(identity, instructor);
      }
      const meeting: Meeting = { type: row.subtype, sec: row.section, day: row.day, start: row.start, end: row.end, room: row.room };
      instructor[row.subtype === 'Lecture' ? 'lectures' : row.subtype === 'Lab' ? 'labs' : 'tutorials'].push(meeting);
    }
    target.name = entries[0].name;
    target.credits = entries[0].credits;
    target.instructors = [...groupByName.values()];
    delete target.awaitingSource; delete target.noFixedSchedule;
    report.applied += parsed.rows.length;
    report.changes.push(`${code}: ${entries[0].name}, ${entries[0].credits} credits, ${parsed.rows.length} sections${entries.length !== parsed.rows.length ? ` (${entries.length - parsed.rows.length} identical duplicates ignored)` : ''}`);
  }
  return report;
}
