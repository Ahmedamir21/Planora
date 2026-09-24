import { createHash, randomBytes, scryptSync } from 'node:crypto';
import handler from '../../../../../../app/api/admin';

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
let storageDown = false;
(globalThis as any).fetch = async (_url: string, options: { body: string }) => {
  if (storageDown) throw new Error('Storage unavailable');
  const [command, ...args] = JSON.parse(options.body);
  let result: any = null;
  if (command === 'GET') result = memory.get(args[0]) ?? null;
  if (command === 'LPUSH') { history.unshift(args[1]); result = history.length; }
  if (command === 'LRANGE') result = history.slice(args[1], args[2] + 1);
  if (command === 'EVAL') {
    const [, , draftKey, , expected, content, record] = args;
    if ((memory.get(draftKey) ?? '') !== expected) result = 0;
    else { memory.set(draftKey, content); history.unshift(record); result = 1; }
  }
  return { ok: true, json: async () => ({ result }) };
};

async function call(method: string, body: unknown = {}, cookie = '', query: Record<string, string> = {}, origin = 'https://example.test') {
  const result: { code: number; body: any; cookie?: string } = { code: 0, body: null };
  const response = { setHeader: (name: string, value: string) => { if (name === 'Set-Cookie') result.cookie = value; }, status: (code: number) => { result.code = code; return response; }, json: (data: any) => { result.body = data; return response; } };
  await handler({ method, headers: { host: 'example.test', origin, cookie }, query, body, socket: { remoteAddress: 'test-ip' } }, response);
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

  const first = JSON.stringify({ key: 'fall-2026-main', calendarStartDate: '2026-09-20', calendarEndDate: '2026-12-31' });
  const second = JSON.stringify({ key: 'fall-2026-main', calendarStartDate: '2026-09-21', calendarEndDate: '2026-12-31' });
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
  assert((await call('DELETE', {}, ahmed)).cookie?.includes('Max-Age=0') === true, 'Logout cookie missing');
  storageDown = true;
  const failed = await call('POST', { action: 'login', username: 'ahmed', password: 'ahmed-long-test-password' });
  assert(failed.code === 503 && !failed.cookie, 'Login succeeded without audit storage');
  console.log('Admin: two accounts, session security, durable attribution, history, stale-save protection and storage failure OK');
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
