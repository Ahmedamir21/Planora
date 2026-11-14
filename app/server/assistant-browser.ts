import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

// Gives each browser a signed id cookie so the rate limit can count per browser.
export function browserId(req, res, secret) {
  const raw = String(req.headers?.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('planora_assistant='))?.slice('planora_assistant='.length);
  const [id, signature, extra] = (raw || '').split('.');
  if (!extra && /^[0-9a-f-]{36}$/.test(id || '') && typeof signature === 'string') {
    const expected = createHmac('sha256', secret).update(id).digest('base64url');
    const received = Buffer.from(signature);
    const correct = Buffer.from(expected);
    if (received.length === correct.length && timingSafeEqual(received, correct)) return id;
  }
  const next = randomUUID();
  const signatureNew = createHmac('sha256', secret).update(next).digest('base64url');
  res.setHeader('Set-Cookie', `planora_assistant=${next}.${signatureNew}; Path=/api/assistant; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
  return next;
}
