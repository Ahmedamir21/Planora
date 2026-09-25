import { readFileSync } from 'node:fs';
import { validateDataset } from '../../../../../../app/dataset-validation.mjs';

const load = name => JSON.parse(readFileSync(new URL(`../src/semester/${name}.json`, import.meta.url), 'utf8'));
const { courses, sch, majors, semester } = {
  courses: load('courses'), sch: load('sch'), majors: load('majors'), semester: load('semester'),
};
const { errors, warnings, summary } = validateDataset({ courses, sch, majors, semester });
console.log(`Semester: ${semester.term} ${semester.year} · ${semester.session}`);
console.log(`${summary.courses} courses · ${summary.meetings} meetings · ${summary.sch} SCH electives`);
console.log(`${summary.missingRooms} rooms unpublished · ${summary.unassigned} instructor groups unassigned · ${errors.length} structural errors`);
warnings.forEach(issue => console.warn(`WARNING: ${issue}`));
if (errors.length) { errors.forEach(issue => console.error(`ERROR: ${issue}`)); process.exitCode = 1; }
else console.log('PASS');
