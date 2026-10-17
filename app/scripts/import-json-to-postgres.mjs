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

async function load(name) {
  const text = await readFile(resolve(DATA_DIR, name), 'utf8');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error(name + ' is not valid JSON'); }
  if (name === 'semester.json') {
    if (!value || typeof value.key !== 'string' || !value.key.trim()) throw new Error('semester.json has no semester key');
  } else if (!Array.isArray(value)) throw new Error(name + ' must be an array');
  return { name, text, value, hash: hash(text) };
}
function validateCourse(course, file, index) {
  if (!course || typeof course.id !== 'string' || !course.id.trim() || typeof course.code !== 'string' ||
      typeof course.name !== 'string' || !Array.isArray(course.instructors)) {
    throw new Error(file + ' item ' + (index + 1) + ' has an invalid course shape');
  }
  const pendingSource = course.awaitingSource === true && course.noFixedSchedule === true;
  if (course.credits !== undefined && (!Number.isFinite(Number(course.credits)) || Number(course.credits) < 0) || course.credits === undefined && !pendingSource) throw new Error(file + ' item ' + (index + 1) + ' has invalid credits');
  for (const [ii, instructor] of course.instructors.entries()) {
    if (!instructor || typeof instructor.name !== 'string') throw new Error(file + ' instructor ' + (ii + 1) + ' is invalid');
    for (const field of ['lectures', 'labs', 'tutorials']) {
      if (!Array.isArray(instructor[field])) throw new Error(file + ': ' + field + ' must be an array');
      for (const [mi, meeting] of instructor[field].entries()) {
        if (!meeting || typeof meeting.day !== 'string' || !Number.isInteger(meeting.start) ||
            !Number.isInteger(meeting.end) || meeting.start < 0 || meeting.start >= 1440 ||
            meeting.end <= meeting.start || meeting.end > 1440) {
          throw new Error(file + ' meeting ' + (mi + 1) + ' has invalid time values');
        }
      }
    }
  }
}
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL privately in your shell; never commit database credentials.');
  const documents = await Promise.all(FILES.map(load));
  const data = Object.fromEntries(documents.map(item => [item.name, item.value]));
  const semester = data['semester.json'];
  const verifiedAt = typeof semester.dataLastVerified === 'string' ? Date.parse(semester.dataLastVerified + 'T00:00:00Z') : NaN;
  const ageDays = Number.isFinite(verifiedAt) ? (Date.now() - verifiedAt) / 86_400_000 : Infinity;
  const maxAgeRaw = process.env.PLANORA_MAX_DATA_AGE_DAYS;
  const maxAgeDays = maxAgeRaw === undefined || maxAgeRaw.trim() === '' ? 7 : Number(maxAgeRaw);
  // Fail closed: a typo such as PLANORA_MAX_DATA_AGE_DAYS=oops must never disable
  // the stale-data guard by making comparisons with NaN evaluate to false.
  if (!Number.isFinite(maxAgeDays) || maxAgeDays < 0 || maxAgeDays > 365) {
    throw new Error('PLANORA_MAX_DATA_AGE_DAYS must be a number between 0 and 365.');
  }
  if (!Number.isFinite(verifiedAt) || ageDays < -1 || ageDays > maxAgeDays) {
    const override = process.env.ALLOW_STALE_DATA_IMPORT === 'true';
    if (!override) throw new Error('Refusing to import stale/undated source JSON (dataLastVerified=' +
      String(semester.dataLastVerified || 'missing') + ', ageDays=' + (Number.isFinite(ageDays) ? ageDays.toFixed(1) : 'unknown') +
      '). Refresh and validate the source data first. An explicit one-off ALLOW_STALE_DATA_IMPORT=true override is available only for a deliberate test import.');
    console.warn('WARNING: ALLOW_STALE_DATA_IMPORT=true; importing stale or undated source JSON by explicit override.');
  }
  const courses = data['courses.json'];
  const sch = data['sch.json'];
  const majors = data['majors.json'];

  for (const [file, items] of [['courses.json', courses], ['sch.json', sch]]) {
    const ids = new Set();
    items.forEach((course, index) => {
      validateCourse(course, file, index);
      if (ids.has(course.id)) throw new Error(file + ' has duplicate ID ' + course.id);
      ids.add(course.id);
    });
  }
  const knownCourseIds = new Set([...courses, ...sch].map(course => course.id));
  const majorIds = new Set();
  for (const major of majors) {
    if (!major || typeof major.id !== 'string' || !Array.isArray(major.years) || majorIds.has(major.id)) throw new Error('majors.json has an invalid or duplicate major');
    majorIds.add(major.id);
    const yearIds = new Set();
    for (const year of major.years) {
      if (!year || typeof year.id !== 'string' || !Array.isArray(year.courseIds) || yearIds.has(year.id)) throw new Error('Major ' + major.id + ' has an invalid or duplicate year');
      yearIds.add(year.id);
      for (const id of year.courseIds) if (!knownCourseIds.has(id)) throw new Error('Major ' + major.id + '/' + year.id + ' references unknown course ' + id);
    }
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 10000, idleTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE planora.catalog_documents IN EXCLUSIVE MODE');
    const existing = await client.query('SELECT 1 FROM planora.catalog_documents LIMIT 1');
    if (existing.rowCount > 0) throw new Error('Catalog documents already exist; refusing to overwrite data.');

    await client.query('INSERT INTO planora.semesters (semester_key, metadata, is_active) VALUES ($1, $2::jsonb, true) ON CONFLICT (semester_key) DO NOTHING',
      [semester.key, JSON.stringify(semester)]);

    for (const doc of documents) {
      await client.query("INSERT INTO planora.catalog_documents (semester_key, document_name, state, content, content_sha256, revision, updated_by) VALUES ($1, $2, 'published', $3::jsonb, $4, 1, 'json-import')",
        [semester.key, doc.name, JSON.stringify(doc.value), doc.hash]);
      await client.query("INSERT INTO planora.catalog_revisions (semester_key, document_name, revision, state, action, content, content_sha256, actor_id, actor_name, reason) VALUES ($1, $2, 1, 'published', 'import', $3::jsonb, $4, 'migration', 'JSON importer', 'Initial repository JSON import')",
        [semester.key, doc.name, JSON.stringify(doc.value), doc.hash]);
    }

    for (const [type, items] of [['courses', courses], ['sch', sch]]) {
      for (const [courseOrder, course] of items.entries()) {
        await client.query('INSERT INTO planora.courses (semester_key, catalog_type, course_id, code, name, category_code, credits, source_order, raw_payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)',
          [semester.key, type, course.id, course.code, course.name, Number.isInteger(course.c) ? course.c : null, course.credits === undefined ? 0 : Number(course.credits), courseOrder, JSON.stringify(course)]);
        for (const [instructorOrder, instructor] of course.instructors.entries()) {
          const result = await client.query('INSERT INTO planora.instructors (semester_key, catalog_type, course_id, instructor_order, name, unassigned, raw_payload) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING instructor_id',
            [semester.key, type, course.id, instructorOrder, instructor.name, instructor.unassigned === true, JSON.stringify(instructor)]);
          const instructorId = result.rows[0].instructor_id;
          for (const [meetingType, field] of [['lecture', 'lectures'], ['lab', 'labs'], ['tutorial', 'tutorials']]) {
            for (const [meetingOrder, meeting] of instructor[field].entries()) {
              await client.query('INSERT INTO planora.meetings (instructor_id, meeting_type, section_code, day, start_minute, end_minute, room, meeting_order, raw_payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)',
                [instructorId, meetingType, String(meeting.sec ?? ''), meeting.day, meeting.start, meeting.end, String(meeting.room ?? ''), meetingOrder, JSON.stringify(meeting)]);
            }
          }
        }
      }
    }

    for (const [majorOrder, major] of majors.entries()) {
      await client.query('INSERT INTO planora.majors (semester_key, major_id, title, subtitle, blurb, source_order, raw_payload) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)',
        [semester.key, major.id, major.title, String(major.subtitle ?? ''), String(major.blurb ?? ''), majorOrder, JSON.stringify(major)]);
      for (const [yearOrder, year] of major.years.entries()) {
        await client.query('INSERT INTO planora.major_years (semester_key, major_id, year_id, label, source_order, raw_payload) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',
          [semester.key, major.id, year.id, year.label, yearOrder, JSON.stringify(year)]);
        for (const [courseOrder, courseId] of year.courseIds.entries()) {
          await client.query('INSERT INTO planora.major_year_courses (semester_key, major_id, year_id, course_id, source_order) VALUES ($1,$2,$3,$4,$5)',
            [semester.key, major.id, year.id, courseId, courseOrder]);
        }
      }
    }
    await client.query("INSERT INTO planora.admin_audit_events (actor_id, actor_name, action, metadata) VALUES ('migration','JSON importer','initial_import',$1::jsonb)",
      [JSON.stringify({ semesterKey: semester.key, documents: documents.length, courses: courses.length, sch: sch.length, majors: majors.length })]);
    await client.query('COMMIT');

    const result = await pool.query('SELECT (SELECT count(*)::int FROM planora.catalog_documents WHERE semester_key=$1) AS documents, (SELECT count(*)::int FROM planora.courses WHERE semester_key=$1) AS courses, (SELECT count(*)::int FROM planora.instructors WHERE semester_key=$1) AS instructors, (SELECT count(*)::int FROM planora.meetings m JOIN planora.instructors i USING (instructor_id) WHERE i.semester_key=$1) AS meetings, (SELECT count(*)::int FROM planora.majors WHERE semester_key=$1) AS majors', [semester.key]);
    console.log(JSON.stringify({ ok: true, semesterKey: semester.key, ...result.rows[0], note: 'Imported to SQL; live API is not switched by this script.' }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(error => { console.error('Import aborted:', error.message); process.exitCode = 1; });
