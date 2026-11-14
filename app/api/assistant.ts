import { rateLimited, storageConfigured } from './admin-store';
import { jsonRequest, sameOrigin } from './security';
import { clientIp } from './admin-security';
import { browserId } from '../server/assistant-browser';
import { exactSectionChange } from '../server/assistant-section-change';
import { buildSystemPrompt } from '../server/assistant-prompt';
import { askGemini } from '../server/assistant-gemini';
import { cleanReply } from '../server/assistant-reply';

// Messages per minute. A new cookie is free for a script, so the IP and global limits are the real ceiling.
const LIMIT_BROWSER = 12;
const LIMIT_IP = 90;
const LIMIT_GLOBAL = 600;

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Invalid origin.' });
  if (!jsonRequest(req, 100_000)) return res.status(413).json({ error: 'Invalid or oversized JSON request.' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'Schedule Assistant is not configured yet. Add GEMINI_API_KEY in Vercel Environment Variables.',
    });
  }

  const secret = process.env.PLANORA_ADMIN_SESSION_SECRET || apiKey;
  if (!storageConfigured()) return res.status(503).json({ error: 'Assistant rate limiting is temporarily unavailable.' });
  try {
    const id = browserId(req, res, secret);
    const ip = clientIp(req);
    // A campus NAT can put many students behind one public address, so the IP limit is generous but finite.
    if (await rateLimited('assistant-ip', ip, LIMIT_IP, 60, secret) ||
        await rateLimited('assistant-browser', id, LIMIT_BROWSER, 60, secret) ||
        await rateLimited('assistant-global', 'all', LIMIT_GLOBAL, 60, secret)) {
      return res.status(429).json({ error: 'Too many messages right now. Please try again in a minute.' });
    }
  } catch {
    return res.status(503).json({ error: 'Assistant rate limiting is temporarily unavailable.' });
  }

  let body = {};
  try {
    body = req.body && typeof req.body === 'object' ? req.body : {};
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const context = body.context && typeof body.context === 'object' ? body.context : {};
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];

  if (!message || message.length > 900) {
    return res.status(400).json({ error: 'Message must be between 1 and 900 characters.' });
  }

  const contextText = JSON.stringify(context);
  if (contextText.length > 80_000) {
    return res.status(413).json({ error: 'Planner context is too large. Refresh the page and try again.' });
  }

  const directChange = exactSectionChange(message, context);
  if (directChange) return res.status(200).json(directChange);

  const system = buildSystemPrompt(contextText);

  const safeHistory = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text.slice(0, 1200) }],
    }));

  try {
    const result = await askGemini(apiKey, system, safeHistory, message);
    if ('error' in result) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(cleanReply(result.parsed, message));
  } catch (error) {
    console.error('Schedule Assistant request failed', error instanceof Error ? error.name : 'unknown');
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return res.status(504).json({ error: 'The assistant took too long to answer. Please try again.' });
    }
    return res.status(502).json({ error: 'The assistant is temporarily unavailable.' });
  }
};
