#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const Pool = pg.Pool;
const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = resolve(APP_DIR, '../Final_Fall_2026_ZewailCity/Templates-Final-Final-main/Zewail-City-Templates-arena-01a09711-zewail-city-templates/Final_Fall_2026_ZewailCity/Final_Fall_2026_Zewail/src/semester');
const FILES = ['semester.json', 'courses.json', 'majors.json', 'sch.json'];
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
};
const equalJson = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

async function main() {
  if (!process.env.DATABASE_URL) fail('Set DATABASE_URL privately; do not put credentials in source control.');
  const docs = await Promise.all(FILES.map(async name => {
    const text = await readFile(resolve(DATA_DIR, name), 'utf8');
    let value;
    try { value = JSON.parse(text); } catch { fail(name + ' is invalid JSON in the repository.'); }
    return { name, text, value, hash: hash(text) };
  }));
  const semester = docs.find(doc => doc.name === 'semester.json').value;
  if (!semester?.key) fail('semester.json has no semester key.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000, idleTimeoutMillis: 5000 });
  try {
    const schema = await pool.query("SELECT to_regclass('planora.catalog_documents') AS documents, to_regclass('planora.catalog_revisions') AS revisions, to_regclass('planora.courses') AS courses, to_regclass('planora.instructors') AS instructors, to_regclass('planora.meetings') AS meetings, to_regclass('planora.majors') AS majors, to_regclass('planora.major_years') AS major_years, to_regclass('planora.major_year_courses') AS major_year_courses");
    for (const [name, value] of Object.entries(schema.rows[0])) if (!value) fail('Required database object is missing: ' + name);

    for (const doc of docs) {
      const result = await pool.query(
        "SELECT content, content_sha256, revision FROM planora.catalog_documents WHERE semester_key=$1 AND document_name=$2 AND state='published'",
        [semester.key, doc.name]
      );
      if (result.rowCount !== 1) fail(doc.name + ': expected exactly one published snapshot, found ' + result.rowCount + '.');
      const stored = result.rows[0];
      if (stored.content_sha256.trim() !== doc.hash) fail(doc.name + ': source SHA-256 does not match the imported snapshot.');
      if (!equalJson(stored.content, doc.value)) fail(doc.name + ': imported JSON content differs from the repository source.');
      const revision = await pool.query(
        "SELECT content, content_sha256, revision FROM planora.catalog_revisions WHERE semester_key=$1 AND document_name=$2 AND state='published' AND revision=$3 AND action='import'",
        [semester.key, doc.name, stored.revision]
      );
      if (revision.rowCount !== 1 || revision.rows[0].content_sha256.trim() !== doc.hash || !equalJson(revision.rows[0].content, doc.value)) {
        fail(doc.name + ': immutable import revision is missing or differs from the source snapshot.');
      }
    }

    const courses = docs.find(doc => doc.name === 'courses.json').value;
    const sch = docs.find(doc => doc.name === 'sch.json').value;
    const majors = docs.find(doc => doc.name === 'majors.json').value;
    const expectedCourses = [...courses.map(x => ({ type: 'courses', value: x })), ...sch.map(x => ({ type: 'sch', value: x }))];
    const dbCourses = await pool.query(
      'SELECT catalog_type, course_id, raw_payload FROM planora.courses WHERE semester_key=$1 ORDER BY catalog_type, source_order',
      [semester.key]
    );
    if (dbCourses.rowCount !== expectedCourses.length) fail('Normalized course count differs: source=' + expectedCourses.length + ', database=' + dbCourses.rowCount + '.');
    for (const expected of expectedCourses) {
      const row = dbCourses.rows.find(item => item.catalog_type === expected.type && item.course_id === expected.value.id);
      if (!row || !equalJson(row.raw_payload, expected.value)) fail('Normalized course payload missing or different: ' + expected.type + '/' + expected.value.id);
    }

    const expectedInstructors = expectedCourses.reduce((sum, item) => sum + item.value.instructors.length, 0);
    const expectedMeetings = expectedCourses.reduce((sum, item) => sum + item.value.instructors.reduce((n, instructor) =>
      n + instructor.lectures.length + instructor.labs.length + instructor.tutorials.length, 0), 0);
    const expectedYears = majors.reduce((sum, major) => sum + major.years.length, 0);
    const expectedMajorCourseLinks = majors.reduce((sum, major) => sum + major.years.reduce((n, year) => n + year.courseIds.length, 0), 0);
    const counts = await pool.query(
      'SELECT (SELECT count(*)::int FROM planora.instructors WHERE semester_key=$1) AS instructors, ' +
      '(SELECT count(*)::int FROM planora.meetings m JOIN planora.instructors i USING (instructor_id) WHERE i.semester_key=$1) AS meetings, ' +
      '(SELECT count(*)::int FROM planora.majors WHERE semester_key=$1) AS majors, ' +
      '(SELECT count(*)::int FROM planora.major_years WHERE semester_key=$1) AS years, ' +
      '(SELECT count(*)::int FROM planora.major_year_courses WHERE semester_key=$1) AS major_course_links, ' +
      "(SELECT count(*)::int FROM planora.catalog_documents WHERE semester_key=$1 AND state='published') AS published_documents",
      [semester.key]
    );
    const actual = counts.rows[0];
    const expectedCounts = { instructors: expectedInstructors, meetings: expectedMeetings, majors: majors.length, years: expectedYears, major_course_links: expectedMajorCourseLinks, published_documents: FILES.length };
    for (const [key, expected] of Object.entries(expectedCounts)) if (actual[key] !== expected) fail(key + ' count mismatch: source=' + expected + ', database=' + actual[key] + '.');

    const mappings = await pool.query(
      'SELECT myc.major_id, myc.year_id, myc.course_id FROM planora.major_year_courses myc WHERE myc.semester_key=$1',
      [semester.key]
    );
    const expectedMappings = new Set();
    for (const major of majors) for (const year of major.years) for (const courseId of year.courseIds) {
      expectedMappings.add(JSON.stringify([major.id, year.id, courseId]));
    }
    const actualMappings = new Set(mappings.rows.map(row => JSON.stringify([row.major_id, row.year_id, row.course_id])));
    if (actualMappings.size !== expectedMappings.size || [...expectedMappings].some(key => !actualMappings.has(key))) {
      fail('Major/year/course mappings differ from majors.json.');
    }

    // Check each normalized child row, not just aggregate counts: aggregate-only
    // checks can miss swapped or incorrectly attached meeting records.
    const normalized = await pool.query(
      'SELECT c.catalog_type, c.course_id, i.instructor_order, i.name AS instructor_name, ' +
      'i.raw_payload AS instructor_payload, m.meeting_type, m.meeting_order, m.raw_payload AS meeting_payload ' +
      'FROM planora.courses c JOIN planora.instructors i ' +
      'ON i.semester_key=c.semester_key AND i.catalog_type=c.catalog_type AND i.course_id=c.course_id ' +
      'LEFT JOIN planora.meetings m ON m.instructor_id=i.instructor_id ' +
      'WHERE c.semester_key=$1 ORDER BY c.catalog_type, c.source_order, i.instructor_order, m.meeting_type, m.meeting_order',
      [semester.key]
    );
    const meetingFields = { lecture: 'lectures', lab: 'labs', tutorial: 'tutorials' };
    const seenInstructors = new Set();
    const seenMeetings = new Set();
    for (const row of normalized.rows) {
      const course = expectedCourses.find(item => item.type === row.catalog_type && item.value.id === row.course_id)?.value;
      if (!course) fail('Unexpected normalized instructor course: ' + row.catalog_type + '/' + row.course_id);
      const instructorKey = JSON.stringify([row.catalog_type, row.course_id, row.instructor_order]);
      const instructor = course.instructors[row.instructor_order];
      if (!instructor) fail('Unexpected instructor order: ' + instructorKey);
      if (!seenInstructors.has(instructorKey)) {
        if (row.instructor_name !== instructor.name || !equalJson(row.instructor_payload, instructor)) {
          fail('Normalized instructor differs from source: ' + instructorKey);
        }
        seenInstructors.add(instructorKey);
      }
      if (row.meeting_type !== null) {
        const field = meetingFields[row.meeting_type];
        const expectedMeeting = field && instructor[field]?.[row.meeting_order];
        const meetingKey = JSON.stringify([instructorKey, row.meeting_type, row.meeting_order]);
        if (!expectedMeeting || !equalJson(row.meeting_payload, expectedMeeting)) {
          fail('Normalized meeting differs from source: ' + meetingKey);
        }
        seenMeetings.add(meetingKey);
      }
    }
    if (seenInstructors.size !== expectedInstructors) fail('Normalized instructor identities differ from source.');
    const expectedMeetingKeys = new Set();
    for (const item of expectedCourses) for (const [instructorOrder, instructor] of item.value.instructors.entries()) {
      const instructorKey = JSON.stringify([item.type, item.value.id, instructorOrder]);
      for (const [meetingType, field] of Object.entries(meetingFields)) {
        for (const [meetingOrder] of instructor[field].entries()) {
          expectedMeetingKeys.add(JSON.stringify([instructorKey, meetingType, meetingOrder]));
        }
      }
    }
    if (seenMeetings.size !== expectedMeetingKeys.size || [...expectedMeetingKeys].some(key => !seenMeetings.has(key))) {
      fail('Normalized meeting identities differ from source.');
    }

    console.log(JSON.stringify({
      ok: true,
      semesterKey: semester.key,
      checks: {
        requiredSchemaObjects: Object.keys(schema.rows[0]).length,
        publishedSnapshotsAndHashes: FILES.length,
        immutableImportRevisions: FILES.length,
        normalizedCourses: dbCourses.rowCount,
        instructors: actual.instructors,
        meetings: actual.meetings,
        majors: actual.majors,
        majorYears: actual.years,
        majorCourseMappings: actual.major_course_links
      },
      note: 'Read-only verification completed. This does not switch or modify the live API.'
    }, null, 2));
  } finally {
    await pool.end();
  }
}
main().catch(error => { console.error('PostgreSQL verification failed:', error.message); process.exitCode = 1; });
