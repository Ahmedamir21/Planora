import { createHash, createHmac, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { draftKey, HISTORY_KEY, redis, saveWithHistory, undoWithHistory, storageConfigured } from './admin-store';
import { validateDataset } from '../dataset-validation.cjs';
import publishedSemester from '../../Final_Fall_2026_ZewailCity/Templates-Final-Final-main/Zewail-City-Templates-arena-01a09711-zewail-city-templates/Final_Fall_2026_ZewailCity/Final_Fall_2026_Zewail/src/semester/semester.json';
import publishedCourses from '../../Final_Fall_2026_ZewailCity/Templates-Final-Final-main/Zewail-City-Templates-arena-01a09711-zewail-city-templates/Final_Fall_2026_ZewailCity/Final_Fall_2026_Zewail/src/semester/courses.json';
import publishedMajors from '../../Final_Fall_2026_ZewailCity/Templates-Final-Final-main/Zewail-City-Templates-arena-01a09711-zewail-city-templates/Final_Fall_2026_ZewailCity/Final_Fall_2026_Zewail/src/semester/majors.json';
import publishedSch from '../../Final_Fall_2026_ZewailCity/Templates-Final-Final-main/Zewail-City-Templates-arena-01a09711-zewail-city-templates/Final_Fall_2026_ZewailCity/Final_Fall_2026_Zewail/src/semester/sch.json';
import { ADMIN_ACCOUNTS } from '../admin-accounts';
import { REPORTS_DATA, REPORTS_KEY } from './reports';
import { REPORT_EMAIL_STATUS } from './report-email';
import { FEEDBACK_DATA, FEEDBACK_IDS, feedbackSummary, type Feedback } from './feedback';

const COOKIE = 'planora_admin';
const FILES = ['semester.json', 'courses.json', 'majors.json', 'sch.json'] as const;
const WINDOW_MS = 15 * 60_000;
const failures = new Map<string, { count: number; since: number }>();
const UPDATE_REPORT = `local old = redis.call('HGET', KEYS[1], ARGV[1])
if not old or old ~= ARGV[2] then return 0 end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
redis.call('LPUSH', KEYS[2], ARGV[4])
return 1`;

type Admin = { id: 'ahmed' | 'youssef'; username: string; name: string; hash: string };
function configured() {
  const secret = process.env.PLANORA_ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32 || !storageConfigured()) return null;
  const admins: Admin[] = ADMIN_ACCOUNTS.map(account => ({
    id: account.id, username: account.username, name: account.name,
    hash: process.env[account.passwordHashEnv] || '',
  }));
  if (admins.some(admin => !admin.username || !admin.hash)) return null;
  if (admins[0].username === admins[1].username) return null;
  return { admins, secret };
}
function equal(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function verifyPassword(password: string, hashSpec: string) {
  const [salt, hash, extra] = hashSpec.split(':');
  if (!salt || !hash || extra || !/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{128}$/.test(hash) || password.length > 256) return false;
  return equal(scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex'), hash);
}
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const sign = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('base64url');
function cookie(value: string, age: number) { return `${COOKIE}=${value}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`; }
function session(req: any, config: NonNullable<ReturnType<typeof configured>>) {
  const value = String(req.headers.cookie || '').split(';').map((part: string) => part.trim()).find((part: string) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra || !equal(signature, sign(payload, config.secret))) return null;
  try {
    const token = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(token.exp) && token.exp > Date.now() ? config.admins.find(a => a.id === token.id) || null : null;
  } catch { return null; }
}
const allowedFile = (name: unknown): name is typeof FILES[number] => typeof name === 'string' && FILES.some(file => file === name);
const published = { 'semester.json': publishedSemester, 'courses.json': publishedCourses, 'majors.json': publishedMajors, 'sch.json': publishedSch };
async function combinedDataset(file?: typeof FILES[number], proposed?: string) {
  const values: Record<string, any> = {};
  for (const name of FILES) {
    const content = file === name && proposed !== undefined ? proposed : await redis(['GET', draftKey(name)]);
    values[name.replace('.json', '')] = content == null ? published[name] : JSON.parse(content);
  }
  return validateDataset(values);
}
function validData(file: typeof FILES[number], content: string) {
  if (content.length > 250_000) return 'Dataset is too large.';
  let value: any;
  try { value = JSON.parse(content); } catch { return 'Invalid JSON.'; }
  if (file === 'semester.json') {
    if (!value || typeof value.key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.calendarStartDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(value.calendarEndDate || '') || value.calendarStartDate > value.calendarEndDate) return 'Invalid semester config or dates.';
    return null;
  }
  if (!Array.isArray(value)) return 'Dataset must be an array.';
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item.id !== 'string' || !item.id || seen.has(item.id)) return 'Missing or duplicate ID.';
    seen.add(item.id);
    if (file === 'majors.json') {
      if (!Array.isArray(item.years) || item.years.some((year: any) => !Array.isArray(year.courseIds))) return 'Invalid major/year mapping.';
    } else {
      if (!item.code || !item.name || !Array.isArray(item.instructors)) return 'Course is missing required fields.';
      for (const teacher of item.instructors) {
        if (typeof teacher.name !== 'string' || !teacher.name.trim()) return 'Instructor name is missing.';
        for (const group of ['lectures', 'labs', 'tutorials']) {
          if (!Array.isArray(teacher[group])) return 'Missing meeting group.';
          for (const meeting of teacher[group]) if (!['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].includes(meeting.day) || !Number.isInteger(meeting.start) || !Number.isInteger(meeting.end) || meeting.start < 0 || meeting.end > 1440 || meeting.start >= meeting.end || typeof meeting.sec !== 'string' || !meeting.sec) return 'Invalid meeting day, time or section.';
        }
      }
    }
  }
  return null;
}
function changes(before: string, after: string): string[] {
  try {
    const previous = JSON.parse(before || 'null'); const next = JSON.parse(after);
    if (Array.isArray(next)) {
      const old = new Map((Array.isArray(previous) ? previous : []).map((x: any) => [x.id, JSON.stringify(x)]));
      const fresh = new Map(next.map((x: any) => [x.id, JSON.stringify(x)]));
      return [...new Set([...old.keys(), ...fresh.keys()])].filter(id => old.get(id) !== fresh.get(id)).slice(0, 30).map(String);
    }
    return Object.keys(next).filter(key => JSON.stringify(previous?.[key]) !== JSON.stringify(next[key])).slice(0, 30);
  } catch { return ['dataset']; }
}
function event(admin: Admin, action: string, options: Record<string, unknown> = {}) {
  return JSON.stringify({ id: randomUUID(), at: new Date().toISOString(), adminId: admin.id, adminName: admin.name, action, ...options });
}
function sameOrigin(req: any) {
  try { return typeof req.headers.origin === 'string' && new URL(req.headers.origin).host === req.headers.host; }
  catch { return false; }
}
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, private'); res.setHeader('X-Content-Type-Options', 'nosniff');
  const config = configured();
  if (!config) return res.status(503).json({ error: 'Set both admin password hashes and the session secret, and connect Upstash Redis to Production in Vercel.' });
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (req.method !== 'GET' && !sameOrigin(req)) return res.status(403).json({ error: 'Invalid origin' });
  const admin = session(req, config);
  if (req.method === 'GET' && !admin) return res.status(200).json({ authenticated: false });
  try {
    if (req.method === 'GET') {
      const action = req.query?.action;
      if (action === 'reports') {
        const rawIds = await redis(['LRANGE', REPORTS_KEY, 0, 499]);
        const rows = rawIds?.length ? await redis(['HMGET', REPORTS_DATA, ...rawIds]) : [];
        const emailStatuses = rawIds?.length ? await redis(['HMGET', REPORT_EMAIL_STATUS, ...rawIds]) : [];
        const reports = (rows || []).map((row: string | null, index: number) => row ? { ...JSON.parse(row), emailStatus: emailStatuses?.[index] || 'not configured' } : null).filter(Boolean);
        return res.status(200).json({ reports, newCount: reports.filter((item: any) => item.status === 'new').length });
      }
      if (action === 'feedback') {
        const ids = await redis(['LRANGE', FEEDBACK_IDS, 0, 499]);
        const raw = ids?.length ? await redis(['HMGET', FEEDBACK_DATA, ...ids]) : [];
        const items: Feedback[] = (raw || []).filter(Boolean).map((row: string) => JSON.parse(row));
        return res.status(200).json({ items, summary: feedbackSummary(items) });
      }
      if (action === 'history') {
        const page = Math.min(100, Math.max(0, Number(req.query?.page) || 0));
        const raw = await redis(['LRANGE', HISTORY_KEY, page * 20, page * 20 + 19]);
        return res.status(200).json({ entries: (raw || []).map((row: string) => JSON.parse(row)) });
      }
      if (action === 'draft') {
        if (!allowedFile(req.query?.file)) return res.status(400).json({ error: 'Invalid filename.' });
        const content = await redis(['GET', draftKey(req.query.file)]);
        return res.status(200).json({ content, revision: content == null ? '' : sha(content) });
      }
      return res.status(200).json({ authenticated: true, user: { id: admin!.id, name: admin!.name } });
    }
    if (req.method === 'DELETE') {
      if (admin) await redis(['LPUSH', HISTORY_KEY, event(admin, 'logout')]);
      res.setHeader('Set-Cookie', cookie('', 0));
      return res.status(200).json({ authenticated: false });
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (body.action === 'login') {
      const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      const record = failures.get(ip);
      if (record && Date.now() - record.since < WINDOW_MS && record.count >= 5) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
      const username = typeof body.username === 'string' ? body.username : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const candidate = config.admins.find(a => equal(a.username, username));
      if (!candidate || !verifyPassword(password, candidate.hash)) {
        failures.set(ip, { count: record && Date.now() - record.since < WINDOW_MS ? record.count + 1 : 1, since: record && Date.now() - record.since < WINDOW_MS ? record.since : Date.now() });
        return res.status(401).json({ error: 'Incorrect username or password.' });
      }
      await redis(['LPUSH', HISTORY_KEY, event(candidate, 'login')]);
      failures.delete(ip);
      const age = 8 * 60 * 60;
      const payload = Buffer.from(JSON.stringify({ id: candidate.id, exp: Date.now() + age * 1000 })).toString('base64url');
      res.setHeader('Set-Cookie', cookie(`${payload}.${sign(payload, config.secret)}`, age));
      return res.status(200).json({ authenticated: true, user: { id: candidate.id, name: candidate.name } });
    }
    if (!admin) return res.status(401).json({ error: 'Sign in again.' });
    if (body.action === 'review_feedback') {
      if (typeof body.id !== 'string' || !/^[\da-f-]{36}$/i.test(body.id) || !['reviewed', 'archived', 'new'].includes(body.status) || typeof body.note !== 'string' || !body.note.trim() || body.note.length > 500) return res.status(400).json({ error: 'Choose a status and add a review note.' });
      const previous = await redis(['HGET', FEEDBACK_DATA, body.id]);
      if (!previous) return res.status(404).json({ error: 'Feedback not found.' });
      const item = JSON.parse(previous);
      const updated = { ...item, status: body.status, note: body.note.trim(), reviewedAt: new Date().toISOString(), reviewedBy: admin.name };
      const record = event(admin, 'review_feedback', { feedbackId: body.id, category: item.category, status: body.status, note: body.note.trim() });
      const result = await redis(['EVAL', UPDATE_REPORT, 2, FEEDBACK_DATA, HISTORY_KEY, body.id, previous, JSON.stringify(updated), record]);
      if (result !== 1) return res.status(409).json({ error: 'Someone else updated this feedback. Refresh the inbox.' });
      return res.status(200).json({ item: updated });
    }
    if (body.action === 'review_report') {
      if (typeof body.id !== 'string' || !/^[\da-f-]{36}$/i.test(body.id) || !['checking', 'dismissed', 'correction_needed', 'resolved'].includes(body.status) || typeof body.note !== 'string' || !body.note.trim() || body.note.length > 500) return res.status(400).json({ error: 'Choose a status and add a review note.' });
      const previous = await redis(['HGET', REPORTS_DATA, body.id]);
      if (!previous) return res.status(404).json({ error: 'Report not found.' });
      const report = JSON.parse(previous);
      const updated = { ...report, status: body.status, note: body.note.trim(), reviewedAt: new Date().toISOString(), reviewedBy: admin.name };
      const log = event(admin, 'review_report', { reportId: body.id, status: body.status, note: body.note.trim() });
      const result = await redis(['EVAL', UPDATE_REPORT, 2, REPORTS_DATA, HISTORY_KEY, body.id, previous, JSON.stringify(updated), log]);
      if (result !== 1) return res.status(409).json({ error: 'Someone else updated this report. Refresh the inbox.' });
      return res.status(200).json({ report: updated });
    }
    if (!allowedFile(body.file)) return res.status(400).json({ error: 'Invalid filename.' });
    if (body.action === 'validate') {
      if (typeof body.content !== 'string' || body.content.length > 250_000) return res.status(400).json({ error: 'Dataset is missing or too large.' });
      try { return res.status(200).json(await combinedDataset(body.file, body.content)); }
      catch { return res.status(400).json({ error: 'Invalid JSON in a semester draft.' }); }
    }
    if (body.action === 'undo') {
      const source = typeof body.source === 'string' ? body.source.trim().slice(0, 240) : '';
      if (!source || typeof body.expectedRevision !== 'string') return res.status(400).json({ error: 'A reason and current revision are required.' });
      const before = await redis(['GET', draftKey(body.file)]) || '';
      if (!before) return res.status(400).json({ error: 'There is no saved draft to undo.' });
      if (sha(before) !== body.expectedRevision) return res.status(409).json({ error: 'Another admin updated this draft. Reload before undoing.' });
      const recent = await redis(['LRANGE', HISTORY_KEY, 0, 999]);
      const last = (recent || []).map((row: string) => JSON.parse(row)).find((entry: any) => entry.file === body.file && ['save_draft', 'undo_draft'].includes(entry.action));
      if (!last || last.after !== before || typeof last.before !== 'string') return res.status(409).json({ error: 'A matching history revision was not found. Review the draft manually.' });
      const entry = event(admin, 'undo_draft', { file: body.file, source, changed: changes(before, last.before), before, after: last.before, method: 'Undo last saved draft' });
      if (await undoWithHistory(body.file, before, last.before, entry) !== 1) return res.status(409).json({ error: 'Another admin updated this draft. Reload before undoing.' });
      return res.status(200).json({ revision: last.before ? sha(last.before) : '', entry: JSON.parse(entry) });
    }
    if (body.action === 'save') {
      const content = typeof body.content === 'string' ? body.content : '';
      const expected = typeof body.expectedRevision === 'string' ? body.expectedRevision : '';
      const source = typeof body.source === 'string' ? body.source.trim().slice(0, 240) : '';
      const error = validData(body.file, content);
      if (error) return res.status(400).json({ error });
      if (!source) return res.status(400).json({ error: 'Add a source or reason for this change.' });
      const before = await redis(['GET', draftKey(body.file)]) || '';
      if (sha(before) !== expected && !(before === '' && expected === '')) return res.status(409).json({ error: 'Another admin updated this draft. Reload it before saving.' });
      if (before === content) return res.status(400).json({ error: 'There are no changes to save.' });
      const entry = event(admin, 'save_draft', { file: body.file, source, changed: changes(before, content), before, after: content, method: 'Planora admin JSON editor' });
      const result = await saveWithHistory(body.file, before, content, entry);
      if (result !== 1) return res.status(409).json({ error: 'Another admin updated this draft. Reload it before saving.' });
      return res.status(200).json({ revision: sha(content), entry: JSON.parse(entry) });
    }
    if (body.action === 'export') {
      const content = await redis(['GET', draftKey(body.file)]);
      if (!content) return res.status(400).json({ error: 'Save a draft before exporting it.' });
      const check = await combinedDataset();
      if (check.errors.length) return res.status(400).json({ error: `Semester draft has ${check.errors.length} validation errors. Run Check whole semester first.`, errors: check.errors.slice(0, 20) });
      await redis(['LPUSH', HISTORY_KEY, event(admin, 'export_draft', { file: body.file, revision: sha(content), method: 'JSON download' })]);
      return res.status(200).json({ content });
    }
    return res.status(400).json({ error: 'Unknown admin action.' });
  } catch (error) {
    console.error('Admin storage operation failed', error instanceof Error ? error.message : 'unknown');
    return res.status(503).json({ error: 'The audit storage is unavailable. No change was saved; try again later.' });
  }
}
