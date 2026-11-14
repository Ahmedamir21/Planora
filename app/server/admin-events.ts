import { randomUUID } from 'node:crypto';
import type { Admin } from './admin-types';

export function event(admin: Admin, action: string, options: Record<string, unknown> = {}) {
  return JSON.stringify({ id: randomUUID(), at: new Date().toISOString(), adminId: admin.id, adminName: admin.name, action, ...options });
}

export function changes(before: string, after: string): string[] {
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
