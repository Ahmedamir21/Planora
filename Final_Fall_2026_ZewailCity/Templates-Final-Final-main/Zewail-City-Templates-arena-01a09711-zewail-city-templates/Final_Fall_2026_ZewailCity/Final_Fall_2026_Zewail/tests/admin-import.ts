import { applyAdminImport, describeDraftChanges, parseAdminImport } from '../src/lib/adminImport';
import published from '../src/semester/courses.json';
import type { Course } from '../src/types';

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const csv = 'courseCode,subtype,section,day,start,end,room,instructor\nCSAI 205,Lecture,03,Tue,10:00,12:00,"G006-B, Building A",Mohamed Maher Ata\nCSAI 205,Lab,08,Fri,13:00,15:00,G1,Someone';
const result = parseAdminImport(csv);
assert(result.rows.length === 1 && result.warnings.length === 1 && result.rows[0].room === 'G006-B, Building A', 'CSV parser accepted a bad day or mishandled quoting');
const before = JSON.stringify(published);
const staged = applyAdminImport(published as Course[], result.rows);
assert(staged.applied === 1 && staged.courses !== published, 'A complete imported section was not staged');
assert(JSON.stringify(published) === before, 'Import changed the published data');
assert(describeDraftChanges(before, JSON.stringify(staged.courses)).some(line => line.includes('CSAI 205 Lecture 03') && line.includes('G006-B')), 'Section comparison omitted the room change');
const missing = applyAdminImport(published as Course[], [{ ...result.rows[0], courseCode: 'UNKNOWN 999' }]);
assert(missing.applied === 0 && missing.warnings.length === 1, 'Unknown course was silently invented');
const copied = parseAdminImport('CSAI 205: Fundamentals of Circuits and Electronics\nSubtype: Lecture | Section: 03\n10:00 AM - 11:59 AM\nTuesday\nZewail City, Room G006-B\nMohamed Maher Ata');
assert(copied.rows.length === 1 && copied.rows[0].end === 720 && copied.rows[0].instructor === 'Mohamed Maher Ata', 'Self-Service text was not parsed correctly');
assert(parseAdminImport('Subtype: Lecture | Section: 03\n10:00 AM - 11:59 AM\nTuesday').rows.length === 0, 'Incomplete copied result was guessed');
console.log('Admin importer: CSV, pasted result, incomplete rows, staging and comparison passed');
