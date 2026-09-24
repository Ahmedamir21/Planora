import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

const COOKIE = 'planora_admin';
const WINDOW_MS = 15 * 60_000;
const failures = new Map<string, { count: number; since: number }>();

function configured() {
  const user = process.env.PLANORA_ADMIN_USERNAME;
  const hash = process.env.PLANORA_ADMIN_PASSWORD_HASH;
  const secret = process.env.PLANORA_ADMIN_SESSION_SECRET;
  return user && hash && secret && secret.length >= 32 ? { user, hash, secret } : null;
}

function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function validCookie(req: any, config: NonNullable<ReturnType<typeof configured>>) {
  const value = String(req.headers.cookie || '').split(';').map((part: string) => part.trim()).find((part: string) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value) return false;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra || !equal(signature, sign(payload, config.secret))) return false;
  try {
    const token = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return token.user === config.user && Number.isFinite(token.exp) && token.exp > Date.now();
  } catch { return false; }
}

function cookie(value: string, age: number) {
  return `${COOKIE}=${value}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}

export default function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const config = configured();
  if (!config) return res.status(503).json({ error: 'Admin login is not configured. Set the three PLANORA_ADMIN_* environment variables in Vercel.' });

  if (req.method === 'GET') return res.status(200).json({ authenticated: validCookie(req, config) });
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const origin = req.headers.origin;
  const host = req.headers.host;
  try {
    if (typeof origin !== 'string' || typeof host !== 'string' || new URL(origin).host !== host) throw new Error('Invalid origin');
  } catch { return res.status(403).json({ error: 'Invalid origin' }); }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookie('', 0));
    return res.status(200).json({ authenticated: false });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const record = failures.get(ip);
  if (record && Date.now() - record.since < WINDOW_MS && record.count >= 5) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const username = typeof req.body?.username === 'string' ? req.body.username : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const [salt, hash, extra] = config.hash.split(':');
  let matches = false;
  if (salt && hash && !extra && /^[0-9a-f]{32}$/.test(salt) && /^[0-9a-f]{128}$/.test(hash) && password.length <= 256) {
    matches = equal(scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex'), hash);
  }
  if (!equal(username, config.user) || !matches) {
    failures.set(ip, { count: record && Date.now() - record.since < WINDOW_MS ? record.count + 1 : 1, since: record && Date.now() - record.since < WINDOW_MS ? record.since : Date.now() });
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }
  failures.delete(ip);
  const age = 8 * 60 * 60;
  const payload = Buffer.from(JSON.stringify({ user: config.user, exp: Date.now() + age * 1000 })).toString('base64url');
  res.setHeader('Set-Cookie', cookie(`${payload}.${sign(payload, config.secret)}`, age));
  return res.status(200).json({ authenticated: true });
}
