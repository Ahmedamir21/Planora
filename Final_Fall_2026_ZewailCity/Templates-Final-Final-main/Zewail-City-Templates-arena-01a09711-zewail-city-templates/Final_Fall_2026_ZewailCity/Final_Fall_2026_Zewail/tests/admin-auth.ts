import { randomBytes, scryptSync } from 'node:crypto';
import handler from '../../../../../../app/api/admin';
const salt = randomBytes(16);
process.env.PLANORA_ADMIN_USERNAME = 'example-admin';
process.env.PLANORA_ADMIN_PASSWORD_HASH = `${salt.toString('hex')}:${scryptSync('a-long-test-password', salt, 64).toString('hex')}`;
process.env.PLANORA_ADMIN_SESSION_SECRET = randomBytes(32).toString('hex');
function call(method: string, body: unknown = {}, cookie = '', origin = 'https://example.test') {
  const headers: Record<string, string> = { host: 'example.test', origin, cookie };
  const result: { code: number; body: any; cookie?: string } = { code: 0, body: null };
  const response = { setHeader: (name: string, value: string) => { if (name === 'Set-Cookie') result.cookie = value; }, status: (code: number) => { result.code = code; return response; }, json: (data: any) => { result.body = data; return response; } };
  handler({ method, headers, body, socket: { remoteAddress: 'test-ip' } }, response);
  return result;
}
if (call('GET').body.authenticated !== false) throw new Error('Guest session accepted');
if (call('POST', { username: 'example-admin', password: 'wrong' }).code !== 401) throw new Error('Wrong password accepted');
if (call('POST', { username: 'example-admin', password: 'a-long-test-password' }, '', 'https://evil.test').code !== 403) throw new Error('Cross-origin login accepted');
const login = call('POST', { username: 'example-admin', password: 'a-long-test-password' });
if (login.code !== 200 || !login.cookie?.includes('HttpOnly; Secure; SameSite=Strict')) throw new Error('Secure login cookie missing');
const cookie = login.cookie.split(';')[0];
if (call('GET', {}, cookie).body.authenticated !== true) throw new Error('Valid session rejected');
if (call('GET', {}, cookie.replace(/.$/, 'x')).body.authenticated !== false) throw new Error('Forged session accepted');
if (call('DELETE', {}, cookie).cookie?.includes('Max-Age=0') !== true) throw new Error('Logout did not clear cookie');
console.log('Admin login: guest, password, origin, session signature and logout OK');
