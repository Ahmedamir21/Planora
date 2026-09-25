import { createHash, randomBytes, scryptSync } from 'node:crypto';
import handler from '../../../../../../app/api/admin';
import reportHandler from '../../../../../../app/api/reports';
import feedbackHandler from '../../../../../../app/api/feedback';
import { redis, storageConfigured } from '../../../../../../app/api/admin-store';
import semester from '../src/semester/semester.json';

const passwordHash = (value: string) => {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(value, salt, 64).toString('hex')}`;
};
process.env.PLANORA_ADMIN_AHMED_PASSWORD_HASH = passwordHash('ahmed-long-test-password');
process.env.PLANORA_ADMIN_YOUSSEF_PASSWORD_HASH = passwordHash('youssef-long-test-password');
process.env.PLANORA_ADMIN_SESSION_SECRET = randomBytes(32).toString('hex');
process.env.UPSTASH_REDIS_REST_URL = 'https://example.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only-token';

const memory = new Map<string, string>();
const history: string[] = [];
const reportIds: string[] = [];
const reportRows = new Map<string, string>();
const feedbackIds: string[] = [];
const feedbackRows = new Map<string, string>();
const emailRows = new Map<string, string>();
const requests = new Map<string, number>();
let emailSends = 0;
let emailShouldFail = false;
let storageDown = false;
(globalThis as any).fetch = async (_url: string, options: { body: string; headers?: Record<string, string> }) => {
  if (_url === 'https://script.google.com/macros/s/test-deployment/exec') {
    emailSends++;
    const payload = JSON.parse(options.body);
    assert(payload.secret === 'x'.repeat(40) && !!payload.id && !options.body.includes('Please check this meeting.'), 'Email webhook exposed the report or missed authentication');
    return { ok: true, status: 200, json: async () => ({ ok: !emailShouldFail }) };
  }
  if (storageDown) throw new Error('Storage unavailable');
  const [command, ...args] = JSON.parse(options.body);
  let result: any = null;
  if (command === 'GET') result = memory.get(args[0]) ?? null;
  if (command === 'LPUSH') { history.unshift(args[1]); result = history.length; }
  if (command === 'LRANGE') result = history.slice(args[1], args[2] + 1);
  if (command === 'HGET') result = (args[0].includes(':feedback:') ? feedbackRows : reportRows).get(args[1]) ?? null;
  if (command === 'HMGET') result = args.slice(1).map((id: string) => (args[0].includes(':email:') ? emailRows : args[0].includes(':feedback:') ? feedbackRows : reportRows).get(id) ?? null);
  if (command === 'HSET') { (args[0].includes(':email:') ? emailRows : reportRows).set(args[1], args[2]); result = 1; }
  if (command === 'LRANGE' && args[0].includes(':reports:')) result = reportIds.slice(args[1], args[2] + 1);
  if (command === 'LRANGE' && args[0].includes(':feedback:')) result = feedbackIds.slice(args[1], args[2] + 1);
  if (command === 'EVAL') {
    if (args[0].includes("redis.call('INCR'")) {
      const [, , limitKey, , , id, content] = args;
      const count = (requests.get(limitKey) || 0) + 1; requests.set(limitKey, count);
      const isFeedback = limitKey.includes(':feedback:');
      const ids = isFeedback ? feedbackIds : reportIds;
      const rows = isFeedback ? feedbackRows : reportRows;
      result = count > (isFeedback ? 3 : 5) ? 0 : ids.length >= 500 ? -1 : 1;
      if (result === 1) { rows.set(id, content); ids.unshift(id); }
    } else if (args[0].includes("redis.call('HGET'")) {
      const [, , , , id, before, after, record] = args;
      const rows = args[2].includes(':feedback:') ? feedbackRows : reportRows;
      result = rows.get(id) === before ? 1 : 0;
      if (result === 1) { rows.set(id, after); history.unshift(record); }
    } else {
      const [, , draftKey, , expected, content, record] = args;
      if ((memory.get(draftKey) ?? '') !== expected) result = 0;
      else { if (args[0].includes("redis.call('DEL'") && !content) memory.delete(draftKey); else memory.set(draftKey, content); history.unshift(record); result = 1; }
    }
  }
  return { ok: true, json: async () => ({ result }) };
};

async function call(method: string, body: unknown = {}, cookie = '', query: Record<string, string> = {}, origin = 'https://example.test') {
  const result: { code: number; body: any; cookie?: string } = { code: 0, body: null };
  const response = { setHeader: (name: string, value: string) => { if (name === 'Set-Cookie') result.cookie = value; }, status: (code: number) => { result.code = code; return response; }, json: (data: any) => { result.body = data; return response; } };
  await handler({ method, headers: { host: 'example.test', origin, cookie }, query, body, socket: { remoteAddress: 'test-ip' } }, response);
  return result;
}
async function reportCall(body: unknown, origin = 'https://example.test') {
  const result: { code: number; body: any } = { code: 0, body: null };
  const response = { setHeader: () => {}, status: (code: number) => { result.code = code; return response; }, json: (data: any) => { result.body = data; return response; } };
  await reportHandler({ method: 'POST', headers: { host: 'example.test', origin }, body, socket: { remoteAddress: 'test-reporter' } }, response);
  return result;
}
async function feedbackCall(body: unknown, origin = 'https://example.test') {
  const result: { code: number; body: any } = { code: 0, body: null };
  const response = { setHeader: () => {}, status: (code: number) => { result.code = code; return response; }, json: (data: any) => { result.body = data; return response; } };
  await feedbackHandler({ method: 'POST', headers: { host: 'example.test', origin }, body, socket: { remoteAddress: 'feedback-test-user' } }, response);
  return result;
}
const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const rev = (value: string) => createHash('sha256').update(value).digest('hex');
const getCookie = (response: Awaited<ReturnType<typeof call>>) => response.cookie!.split(';')[0];

async function main() {
  assert(!(await call('GET')).body.authenticated, 'Guest authenticated');
  assert((await call('POST', { action: 'login', username: 'ahmed', password: 'youssef-long-test-password' })).code === 401, 'Accounts share passwords');
  assert((await call('POST', { action: 'login', username: 'ahmed', password: 'ahmed-long-test-password' }, '', {}, 'https://evil.test')).code === 403, 'Origin check failed');
  const a = await call('POST', { action: 'login', username: 'ahmed', password: 'ahmed-long-test-password' });
  const b = await call('POST', { action: 'login', username: 'youssef', password: 'youssef-long-test-password' });
  assert(a.code === 200 && b.code === 200 && !!a.cookie?.includes('HttpOnly; Secure; SameSite=Strict'), 'Separate secure logins failed');
  const ahmed = getCookie(a), youssef = getCookie(b);
  assert((await call('GET', {}, ahmed)).body.user.name === 'Ahmed Amir', 'Ahmed identity missing');
  assert((await call('GET', {}, youssef)).body.user.name === 'Youssef Taha', 'Youssef identity missing');
  assert(!(await call('GET', {}, ahmed.replace(/.$/, 'x'))).body.authenticated, 'Forged session accepted');

  const first = JSON.stringify(semester);
  const second = JSON.stringify({ ...semester, calendarStartDate: '2026-09-21' });
  const saveA = await call('POST', { action: 'save', file: 'semester.json', content: first, expectedRevision: '', source: 'Source supplied by creator' }, ahmed);
  assert(saveA.code === 200 && saveA.body.revision === rev(first), 'First save failed');
  const stale = await call('POST', { action: 'save', file: 'semester.json', content: second, expectedRevision: '', source: 'Self-Service' }, youssef);
  assert(stale.code === 409, 'Concurrent stale save was accepted');
  const saveB = await call('POST', { action: 'save', file: 'semester.json', content: second, expectedRevision: rev(first), source: 'Self-Service' }, youssef);
  assert(saveB.code === 200, 'Second save failed');
  const entries = (await call('GET', {}, ahmed, { action: 'history', page: '0' })).body.entries;
  assert(entries[0].adminName === 'Youssef Taha' && entries[0].before === first && entries[0].after === second && entries[0].source === 'Self-Service', 'Change attribution/history missing');
  assert(entries[1].adminName === 'Ahmed Amir' && entries[1].after === first && entries[1].method === 'Planora admin JSON editor', 'Initial attribution missing');
  assert((await call('GET', {}, youssef, { action: 'draft', file: 'semester.json' })).body.content === second, 'Persistent draft missing');
  assert((await call('POST', { action: 'export', file: 'semester.json' }, ahmed)).body.content === second, 'Export failed');
  const check = await call('POST', { action: 'validate', file: 'semester.json', content: second }, ahmed);
  assert(check.code === 200 && check.body.errors.length === 0 && check.body.summary.courses > 0, 'Whole dataset validation failed');
  const invalid = await call('POST', { action: 'validate', file: 'semester.json', content: JSON.stringify({ ...semester, calendarEndDate: '2026-02-30' }) }, ahmed);
  assert(invalid.code === 200 && invalid.body.errors.some((message: string) => message.includes('calendar')), 'Impossible semester date was accepted');
  assert((await call('POST', { action: 'undo', file: 'semester.json', expectedRevision: rev(first), source: 'Undo verified edit' }, ahmed)).code === 409, 'Stale undo accepted');
  const undone = await call('POST', { action: 'undo', file: 'semester.json', expectedRevision: rev(second), source: 'Undo verified edit' }, ahmed);
  assert(undone.code === 200 && undone.body.entry.adminId === 'ahmed' && undone.body.entry.before === second && undone.body.entry.after === first, 'Undo was not attributed to admin');
  assert((await call('GET', {}, youssef, { action: 'draft', file: 'semester.json' })).body.content === first, 'Undo did not restore previous draft');
  const report = { types: ['Day or time', 'Room'], courseCode: 'CSAI 205', component: 'Lecture', section: '03', details: 'Please check this meeting.', publishedData: 'Current meeting' };
  assert((await reportCall(report, 'https://evil.test')).code === 403, 'Cross-origin report accepted');
  assert((await reportCall({ ...report, types: ['Invalid'] })).code === 400, 'Invalid report type accepted');
  assert((await reportCall({ ...report, reporterName: 'x'.repeat(61) })).code === 400, 'Overlong optional reporter name accepted');
  const submitted = await reportCall({ ...report, reporterName: 'Tester' });
  assert(submitted.code === 201 && !!submitted.body.id, 'Student report was not delivered');
  assert(!(await call('GET', {}, '', { action: 'reports' })).body.reports, 'Guest accessed reports');
  const inbox = (await call('GET', {}, ahmed, { action: 'reports' })).body;
  assert(inbox.newCount === 1 && inbox.reports[0].details === report.details && inbox.reports[0].reporterName === 'Tester', 'Private inbox missed the optional reporter name');
  assert((await call('POST', { action: 'review_report', id: submitted.body.id, status: 'dismissed', note: '' }, ahmed)).code === 400, 'Review without reason accepted');
  assert((await call('POST', { action: 'review_report', id: submitted.body.id, status: 'dismissed', note: 'Verified no change on Self-Service' }, youssef)).code === 200, 'Report review failed');
  assert((await call('GET', {}, ahmed, { action: 'reports' })).body.newCount === 0, 'Reviewed report still marked new');
  assert((await call('GET', {}, ahmed, { action: 'history' })).body.entries[0].adminName === 'Youssef Taha', 'Review attribution missing');
  process.env.PLANORA_REPORT_MAIL_WEBHOOK_URL = 'https://script.google.com/macros/s/test-deployment/exec';
  process.env.PLANORA_REPORT_MAIL_WEBHOOK_SECRET = 'x'.repeat(40);
  assert((await reportCall(report)).code === 201 && emailSends === 1, 'Configured email was not attempted');
  emailShouldFail = true;
  assert((await reportCall(report)).code === 201, 'Email outage caused student report loss');
  assert((await call('GET', {}, ahmed, { action: 'reports' })).body.reports[0].emailStatus === 'failed', 'Failed email not shown in admin inbox');
  delete process.env.PLANORA_REPORT_MAIL_WEBHOOK_URL;
  for (let i = 0; i < 2; i++) assert((await reportCall(report)).code === 201, 'Allowed report rejected');
  assert((await reportCall(report)).code === 429, 'Report rate limit failed');
  const message = { category: 'Schedule generator', rating: 8, message: 'Easy to create a schedule.' };
  assert((await feedbackCall(message, 'https://evil.test')).code === 403, 'Cross-origin feedback accepted');
  assert((await feedbackCall({ ...message, rating: 11 })).code === 400, 'Invalid feedback rating accepted');
  assert((await feedbackCall({ ...message, rating: null })).code === 400, 'Missing rating accepted');
  assert((await feedbackCall({ ...message, category: 'invalid' })).code === 400, 'Invalid feedback category accepted');
  assert((await feedbackCall({ ...message, reporterName: 'x'.repeat(61) })).code === 400, 'Overlong optional feedback name accepted');
  const feedback = await feedbackCall({ ...message, reporterName: 'Test nickname' });
  assert(feedback.code === 201, 'Feedback not delivered');
  assert(!(await call('GET', {}, '', { action: 'feedback' })).body.items, 'Guest accessed feedback');
  const collected = (await call('GET', {}, ahmed, { action: 'feedback' })).body;
  assert(collected.items[0].message === message.message && collected.items[0].reporterName === 'Test nickname' && collected.summary.newCount === 1 && collected.summary.averageRating === 8 && collected.summary.categories['Schedule generator'] === 1, 'Feedback name or summary wrong');
  assert((await call('POST', { action: 'review_feedback', id: feedback.body.id, status: 'archived', note: '' }, ahmed)).code === 400, 'Feedback review without note accepted');
  assert((await call('POST', { action: 'review_feedback', id: feedback.body.id, status: 'reviewed', note: 'Read and noted.' }, youssef)).code === 200, 'Feedback review failed');
  assert((await call('GET', {}, ahmed, { action: 'feedback' })).body.summary.newCount === 0, 'Reviewed feedback still marked new');
  assert((await call('GET', {}, ahmed, { action: 'history' })).body.entries[0].adminName === 'Youssef Taha', 'Feedback review attribution missing');
  assert((await feedbackCall({ category: 'Overall experience', rating: 9, message: '' })).code === 201, 'Anonymous overall rating-only feedback rejected');
  assert((await feedbackCall(message)).code === 201 && (await feedbackCall(message)).code === 429, 'Feedback rate limit failed');
  assert((await call('DELETE', {}, ahmed)).cookie?.includes('Max-Age=0') === true, 'Logout cookie missing');
  storageDown = true;
  const failed = await call('POST', { action: 'login', username: 'ahmed', password: 'ahmed-long-test-password' });
  assert(failed.code === 503 && !failed.cookie, 'Login succeeded without audit storage');
  storageDown = false;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.KV_REST_API_URL = 'https://kv.example.test';
  process.env.KV_REST_API_TOKEN = 'test-kv-token';
  assert(storageConfigured(), 'Vercel Upstash KV integration was not detected');
  assert((await redis(['GET', 'test:key'])) === null, 'Vercel Upstash KV REST access failed');
  assert((await call('GET')).code === 200, 'Admin unavailable with Vercel Upstash KV integration');
  console.log('Admin: two accounts, session security, durable attribution, history, stale-save protection and storage failure OK');
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
