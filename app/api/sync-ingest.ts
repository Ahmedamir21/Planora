import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { jsonRequest } from './security';
import { liveKey, HISTORY_KEY, rateLimited, redis, storageConfigured } from './admin-store';
import { SYNC_DRAFT_KEY, SYNC_STATUS_KEY, stageSyncDraft } from './sync-store';
import { validateDataset } from '../dataset-validation.cjs';
import publishedSemester from '../../Final_Fall_2026_ZewailCity/Templates-Final-Final-main/Zewail-City-Templates-arena-01a09711-zewail-city-templates/Final_Fall_2026_ZewailCity/Final_Fall_2026_Zewail/src/semester/semester.json';
import publishedCourses from '../../Final_Fall_2026_ZewailCity/Templates-Final-Final-main/Zewail-City-Templates-arena-01a09711-zewail-city-templates/Final_Fall_2026_ZewailCity/Final_Fall_2026_Zewail/src/semester/courses.json';
import publishedMajors from '../../Final_Fall_2026_ZewailCity/Templates-Final-Final-main/Zewail-City-Templates-arena-01a09711-zewail-city-templates/Final_Fall_2026_ZewailCity/Final_Fall_2026_Zewail/src/semester/majors.json';
import publishedSch from '../../Final_Fall_2026_ZewailCity/Templates-Final-Final-main/Zewail-City-Templates-arena-01a09711-zewail-city-templates/Final_Fall_2026_ZewailCity/Final_Fall_2026_Zewail/src/semester/sch.json';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
function equal(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function bearer(req: any) {
  const header = String(req.headers?.authorization || '');
  return /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '') : '';
}
function counts(courses: any[], sch: any[]) {
  const all = [...courses, ...sch];
  let sections = 0;
  for (const course of all) for (const instructor of course?.instructors || [])
    sections += (instructor.lectures?.length || 0) + (instructor.labs?.length || 0) + (instructor.tutorials?.length || 0);
  return { courses: all.length, sections };
}
function diff(beforeCourses: any[], beforeSch: any[], nextCourses: any[], nextSch: any[]) {
  const before = [...beforeCourses, ...beforeSch], next = [...nextCourses, ...nextSch];
  const oldMap = new Map(before.map((course: any) => [course.id, { raw: JSON.stringify(course), code: course.code || course.id }]));
  const newMap = new Map(next.map((course: any) => [course.id, { raw: JSON.stringify(course), code: course.code || course.id }]));
  const ids = new Set([...oldMap.keys(), ...newMap.keys()]);
  const changed: string[] = [], added: string[] = [], removed: string[] = [];
  ids.forEach(id => {
    const oldCourse = oldMap.get(id), newCourse = newMap.get(id);
    if (!oldCourse && newCourse) added.push(String(newCourse.code));
    else if (oldCourse && !newCourse) removed.push(String(oldCourse.code));
    else if (oldCourse?.raw !== newCourse?.raw) changed.push(String(newCourse?.code || oldCourse?.code || id));
  });
  const oldCounts = counts(beforeCourses, beforeSch), nextCounts = counts(nextCourses, nextSch);
  return { changedCourses: changed.length, addedCourses: added.length, removedCourses: removed.length, changed: changed.slice(0,100), added: added.slice(0,100), removed: removed.slice(0,100), previousSections: oldCounts.sections, sections: nextCounts.sections, sectionDelta: nextCounts.sections - oldCounts.sections };
}
async function liveCatalog() {
  const [coursesRaw, schRaw] = await Promise.all([redis(['GET', liveKey('courses.json')]), redis(['GET', liveKey('sch.json')])]);
  return {
    courses: coursesRaw ? JSON.parse(coursesRaw) : publishedCourses,
    sch: schRaw ? JSON.parse(schRaw) : publishedSch,
  };
}
function status(data: Record<string, unknown>) { return JSON.stringify({ ...data, updatedAt: new Date().toISOString() }); }
function history(source: string, changed: string[]) {
  return JSON.stringify({ id: randomUUID(), at: new Date().toISOString(), admin: { id: 'agent', name: 'Self-Service Agent' }, action: 'sync_stage', source, changed, method: 'Machine ingest → Draft only; live data unchanged' });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  if (!jsonRequest(req, 2_000_000)) return res.status(415).json({ error: 'Expected JSON payload up to 2 MB.' });
  const secret = process.env.PLANORA_SYNC_INGEST_SECRET || '';
  if (secret.length < 32 || !storageConfigured()) return res.status(503).json({ error: 'Sync ingest is not configured.' });
  const token = bearer(req);
  if (!token || !equal(token, secret)) return res.status(401).json({ error: 'Invalid sync credential.' });
  if (await rateLimited('sync-ingest', 'self-service-agent', 8, 3600, secret)) return res.status(429).json({ error: 'Sync ingest rate limit reached.' });

  const body = req.body || {}, dataset = body.dataset;
  const source = typeof body.source === 'string' ? body.source.trim().slice(0,240) : '';
  if (!source || !dataset || !Array.isArray(dataset.courses) || !Array.isArray(dataset.sch)) return res.status(400).json({ error: 'Missing source, courses, or SCH dataset.' });

  const previous = await redis(['GET', SYNC_DRAFT_KEY]) || '';
  if (previous) return res.status(409).json({ error: 'A Self-Service draft is already waiting for admin review. Nothing was overwritten.' });

  const check = validateDataset({ semester: publishedSemester, majors: publishedMajors, courses: dataset.courses, sch: dataset.sch });
  const agentWarnings = Array.isArray(body.agentWarnings) ? body.agentWarnings.filter((item: unknown) => typeof item === 'string').slice(0,100) : [];
  if (check.errors.length) {
    const failedAt = new Date().toISOString(), c = counts(dataset.courses, dataset.sch);
    await redis(['SET', SYNC_STATUS_KEY, status({ state:'Failed', phase:'validation_failed', startedAt: typeof body.startedAt === 'string' ? body.startedAt : failedAt, finishedAt:failedAt, source, ...c, errors:check.errors.length, warnings:check.warnings.length + agentWarnings.length })]);
    await redis(['LPUSH', HISTORY_KEY, JSON.stringify({ id: randomUUID(), at: failedAt, admin:{ id:'agent', name:'Self-Service Agent' }, action:'sync_rejected', source, changed:check.errors.slice(0,10), method:'Machine ingest rejected before Draft; live data unchanged' })]);
    return res.status(400).json({ error:`Fetched data has ${check.errors.length} blocking validation errors. Live data was not changed.`, errors:check.errors.slice(0,30) });
  }

  const live = await liveCatalog(), changes = diff(live.courses, live.sch, dataset.courses, dataset.sch);
  const warnings = [...agentWarnings, ...check.warnings];
  const sectionBase = Math.max(1, changes.previousSections);
  if (Math.abs(changes.sectionDelta) > Math.max(20, Math.ceil(sectionBase * 0.25))) warnings.unshift(`Large section-count change: ${changes.previousSections} → ${changes.sections}. Review before publishing.`);
  if (changes.addedCourses || changes.removedCourses) warnings.unshift(`Course set changed: +${changes.addedCourses} / -${changes.removedCourses}. Review course mapping before publishing.`);

  const now = new Date().toISOString();
  const payload = JSON.stringify({ source, fetchedAt: typeof body.fetchedAt === 'string' ? body.fetchedAt : now, stagedAt:now, courses:dataset.courses, sch:dataset.sch, validation:{ warnings, summary:check.summary }, changes });
  const state = warnings.length ? 'Warning' : 'Success';
  const c = counts(dataset.courses, dataset.sch);
  const ok = await stageSyncDraft('', payload, status({ state, phase:'draft_ready', startedAt: typeof body.startedAt === 'string' ? body.startedAt : now, finishedAt:now, source, ...c, warnings:warnings.length }), history(source, [`${changes.changedCourses} changed courses`, `${changes.addedCourses} added`, `${changes.removedCourses} removed`, `${changes.sectionDelta >= 0 ? '+' : ''}${changes.sectionDelta} sections`]));
  if (ok !== 1) return res.status(409).json({ error: 'A draft appeared while ingesting. Nothing was overwritten.' });
  return res.status(200).json({ staged:true, draftRevision:sha(payload), state, warnings, changes, summary:check.summary });
}
