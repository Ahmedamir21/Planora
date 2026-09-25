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
// Self-Service's Copy action can omit the course heading entirely. The admin must
// select a course, and every complete result block must still import correctly.
const copiedWithoutHeading = parseAdminImport(`16 Results

Year: 2026 | Term: Fall | Session: Main

Subtype: Lecture | Section: 01

Type: Course | Credit type: Credit

Duration: 9/12/2026 - 1/24/2027

8:00 AM - 9:59 AM

Tuesday

Zewail City New Campus, Academic Building , Room G025B

Walaa El-Sharkawy El-Sharkawy

3.00
Credits

0
Seats Left

Year: 2026 | Term: Fall | Session: Main

Subtype: Lecture | Section: 02

Type: Course | Credit type: Credit

Duration: 9/12/2026 - 1/24/2027

2:00 PM - 3:59 PM

Wednesday

Zewail City New Campus, Academic Building , Room G019-B

Mohamed Fawzy Fawzy

3.00
Credits

0
Seats Left

Year: 2026 | Term: Fall | Session: Main

Subtype: Tutorial | Section: 01

Type: Course | Credit type: Credit

Duration: 9/12/2026 - 1/24/2027

12:00 PM - 1:59 PM

Tuesday

Zewail City New Campus, Academic Building , Room G009-B

Walaa El-Sharkawy El-Sharkawy

0.00
Credits

0
Seats Left`, 'MATH 105');
assert(copiedWithoutHeading.rows.length === 3 && copiedWithoutHeading.warnings.length === 0, 'Actual copied Self-Service blocks were not imported');
assert(copiedWithoutHeading.rows[0].room === 'G025B' && copiedWithoutHeading.rows[0].end === 600 && copiedWithoutHeading.rows[1].instructor === 'Mohamed Fawzy Fawzy' && copiedWithoutHeading.rows[2].subtype === 'Tutorial', 'Actual Self-Service room, time or instructor was misread');
assert(parseAdminImport('Subtype: Lecture | Section: 01\n8:00 AM - 9:59 AM\nTuesday\nRoom G025B\nWalaa El-Sharkawy El-Sharkawy').rows.length === 0, 'Missing course heading was silently guessed');
assert(parseAdminImport('Subtype: Lecture | Section: 03\n10:00 AM - 11:59 AM\nTuesday').rows.length === 0, 'Incomplete copied result was guessed');
const excel = parseAdminImport('\uFEFF"Course code",subtype,section,day,start,end,room,instructor\r\nCSAI 205,Lecture,03,Tue,10:00,12:00,G006-B,Mohamed Maher Ata', '', 'csv');
assert(excel.rows.length === 1 && excel.rows[0].section === '03', 'UTF-8 BOM and quoted Excel CSV header were not accepted');
assert(parseAdminImport('wrong,header\nCSAI 205,Lecture', '', 'csv').warnings.some(w => w.includes('header')), 'Malformed CSV header was not explained');
assert(parseAdminImport('courseCode,subtype,section,day,start,end,room,instructor\nCSAI 205,Lecture,03,Tue,10:00,12:00,G006-B,Mohamed Maher Ata,extra', '', 'csv').rows.length === 0, 'Extra columns were silently shifted');
const duplicates = parseAdminImport('courseCode,subtype,section,day,start,end,room,instructor\nCSAI 205,Lecture,03,Tue,10:00,12:00,G006-B,Mohamed Maher Ata\nCSAI 205,Lecture,03,Wed,10:00,12:00,G019-B,Mohamed Maher Ata', '', 'csv');
assert(duplicates.rows.length === 0 && duplicates.warnings.length === 2, 'Conflicting duplicate sections must not be staged');
console.log('Admin importer: CSV, pasted result, incomplete rows, staging and comparison passed');
