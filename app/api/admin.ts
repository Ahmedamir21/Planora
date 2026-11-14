import { HISTORY_KEY, redis } from './admin-store';
import { jsonRequest, sameOrigin } from './security';
import { configured, cookie, session } from '../server/admin-session';
import { event } from '../server/admin-events';
import { NOT_HANDLED } from '../server/admin-types';
import { handleRead } from '../server/admin-reads';
import { handleLogin } from '../server/admin-login';
import { handleSync } from '../server/admin-sync';
import { handleReview } from '../server/admin-reviews';
import { handleDataset } from '../server/admin-drafts';

// Admin API. This file only checks the request and hands it to the right helper in app/server.
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, private'); res.setHeader('X-Content-Type-Options', 'nosniff');
  const config = configured();
  if (!config) return res.status(503).json({ error: 'Set both admin password hashes and the session secret, and connect Upstash Redis to Production in Vercel.' });
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (req.method !== 'GET' && !sameOrigin(req)) return res.status(403).json({ error: 'Invalid origin' });
  if (req.method === 'POST' && !jsonRequest(req, 300_000)) return res.status(413).json({ error: 'Invalid or oversized JSON request.' });
  const admin = session(req, config);
  if (req.method === 'GET' && !admin) return res.status(200).json({ authenticated: false });
  try {
    if (req.method === 'GET') return await handleRead(req, res, admin!);
    if (req.method === 'DELETE') {
      if (admin) await redis(['LPUSH', HISTORY_KEY, event(admin, 'logout')]);
      res.setHeader('Set-Cookie', cookie('', 0));
      return res.status(200).json({ authenticated: false });
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (body.action === 'login') return await handleLogin(req, res, body, config);
    if (!admin) return res.status(401).json({ error: 'Sign in again.' });
    for (const run of [handleSync, handleReview, handleDataset]) {
      const result = await run(body, admin, res);
      if (result !== NOT_HANDLED) return result;
    }
    return res.status(400).json({ error: 'Unknown admin action.' });
  } catch {
    console.error('Admin storage operation failed.');
    return res.status(503).json({ error: 'The audit storage is unavailable. No change was saved; try again later.' });
  }
}
