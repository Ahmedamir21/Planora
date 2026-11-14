import { createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { storageConfigured } from '../api/admin-store';
import { ADMIN_ACCOUNTS } from '../admin-accounts';
import type { Admin } from './admin-types';

const COOKIE = 'planora_admin';
export function configured() {
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
export function equal(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function verifyPassword(password: string, hashSpec: string) {
  const [salt, hash, extra] = hashSpec.split(':');
  if (!salt || !hash || extra || !/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{128}$/.test(hash) || password.length > 256) return false;
  return equal(scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex'), hash);
}
export const sha = (text: string) => createHash('sha256').update(text).digest('hex');
export const sign = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('base64url');
export function cookie(value: string, age: number) { return `${COOKIE}=${value}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`; }
export function session(req: any, config: NonNullable<ReturnType<typeof configured>>) {
  const value = String(req.headers.cookie || '').split(';').map((part: string) => part.trim()).find((part: string) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra || !equal(signature, sign(payload, config.secret))) return null;
  try {
    const token = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(token.exp) && token.exp > Date.now() ? config.admins.find(a => a.id === token.id) || null : null;
  } catch { return null; }
}
export type AdminConfig = NonNullable<ReturnType<typeof configured>>;
