import { redis, HISTORY_KEY, rateLimited } from '../api/admin-store';
import { clientIp, securityEmail, securityEvent } from '../api/admin-security';
import { cookie, equal, sign, verifyPassword, type AdminConfig } from './admin-session';
import { event } from './admin-events';

export async function handleLogin(req: any, res: any, body: any, config: AdminConfig) {
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const ip = clientIp(req);
  if (await rateLimited('admin-login', ip, 5, 15 * 60, config.secret)) {
    const blocked = await securityEvent(req, 'login_blocked', username);
    if (!(await rateLimited('admin-alert-blocked', ip, 1, 15 * 60, config.secret))) await securityEmail(blocked);
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
  const candidate = config.admins.find(a => equal(a.username, username));
  if (!candidate || !verifyPassword(password, candidate.hash)) {
    await securityEvent(req, 'login_failure', username);
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }
  const signIn = await securityEvent(req, 'login_success', username, candidate.name);
  await redis(['LPUSH', HISTORY_KEY, event(candidate, 'login')]);
  const age = 8 * 60 * 60;
  const payload = Buffer.from(JSON.stringify({ id: candidate.id, exp: Date.now() + age * 1000 })).toString('base64url');
  res.setHeader('Set-Cookie', cookie(`${payload}.${sign(payload, config.secret)}`, age));
  await securityEmail(signIn);
  return res.status(200).json({ authenticated: true, user: { id: candidate.id, name: candidate.name } });
}
