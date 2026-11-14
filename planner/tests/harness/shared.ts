/* ---------- browser shims (share.ts uses window.btoa/atob, appState uses window.localStorage) ---------- */
// @ts-expect-error test shim
globalThis.window = globalThis;
import type { Meeting } from '../../src/lib/time';

export function base64UrlEncodeShim(input: string): string {
  return Buffer.from(input, 'binary').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Counters live in an object so every test file can update them.
export const stats = { pass: 0, fail: 0 };
export function check(name: string, cond: boolean): void {
  if (cond) stats.pass++;
  else {
    stats.fail++;
    console.error('FAIL:', name);
  }
}

export const mm = (day: Meeting['day'], s: number, e: number, type: Meeting['type'] = 'Lecture', sec = 'x', room = 'r'): Meeting => ({
  type,
  sec,
  day,
  start: s,
  end: e,
  room,
});

