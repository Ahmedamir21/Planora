/**
 * Component test for the Share sheet (real DOM): the input must contain the current
 * deployment origin (never a stale/sandbox artifact), the payload must roundtrip, and the
 * copy UX (button + "Schedule link copied!" status) must still work.
 * Run via: npm run test:ui
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://fall-2026-zewail-city.vercel.app/?sbx_debug=1&schedule=STALE#about',
});
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.Event = dom.window.Event;
g.IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ShareSchedule } from '../src/components/ShareSchedule';
import { COURSE_BY_ID } from '../src/data/courses';
import { emptyPick, optionStates, uid, type PickState } from '../src/lib/picks';
import { decodeSchedule } from '../src/lib/share';
import { DEFAULT_PREFERENCES } from '../src/lib/preferences';
import type { Course } from '../src/types';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) pass++;
  else {
    fail++;
    console.error('FAIL:', name);
  }
}

const doc = dom.window.document;

const courses: Course[] = [COURSE_BY_ID['csai203'], COURSE_BY_ID['phys104']];
const picks: PickState = {};
for (const c of courses) {
  const p = emptyPick();
  const lec = optionStates(c, 'Lecture', [], {})[0];
  const lab = optionStates(c, 'Lab', [c], { ...picks, [c.id]: p })[0];
  if (lec) p.Lecture = lec.key;
  if (lab) p.Lab = lab.key;
  picks[c.id] = p;
}

// Clipboard stub so the copy path exercises its success state.
Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });

async function main(): Promise<void> {
const root = createRoot(doc.getElementById('root')!);
await act(async () => {
  root.render(
    React.createElement(ShareSchedule, {
      majorId: 'software',
      courses,
      picks,
      label: '🔗 Share Schedule',
      extras: {
        requireComplete: true,
        typeFilter: 'Lab',
        courseFilter: 'all',
        preferences: { ...DEFAULT_PREFERENCES, maxHoursPerDay: 5, maxHoursHard: true, keepFreeDays: ['Wed'] },
        instructorFilter: { csai203: 1 },
      },
      summary: { majorName: 'Software Engineering', selectedCount: 2, totalCredits: 6, conflictFree: true },
    }),
  );
});

const trigger = Array.from(doc.querySelectorAll('button')).find((b) => b.textContent?.includes('Share Schedule'))!;
check('share trigger renders', !!trigger);
await act(async () => {
  trigger.click();
});

const linkInput = doc.querySelector('input[aria-label="Shareable schedule link"]') as HTMLInputElement | null;
check('share sheet opens with the link input', !!linkInput);
if (linkInput) {
  const url = linkInput.value;
  check('URL uses the live deployment origin — NOT a sandbox host', url.startsWith('https://fall-2026-zewail-city.vercel.app/?schedule='));
  check('no arena/sbx debug param or stale ?schedule= leaked', !url.includes('arena') && !url.includes('sbx_debug') && !url.includes('STALE'));
  check('no hash appended', !url.includes('#about'));
  const decoded = decodeSchedule(new URL(url).searchParams.get('schedule')!);
  check('payload decodes on a fresh device', !!decoded && decoded.majorId === 'software');
  check('selected courses + sections survive', !!decoded && courses.every((c) => decoded.picks[c.id]?.Lecture === picks[c.id]?.Lecture));
  check('instructor pin survives', !!decoded && decoded.instructorFilter.csai203 === 1);
  check('filters + max hours + hard flag survive', !!decoded && decoded.typeFilter === 'Lab' && decoded.preferences?.maxHoursPerDay === 5 && decoded.preferences?.maxHoursHard === true);
}
check('conflict-free summary strip present (existing UX preserved)', doc.body.textContent?.includes('✓ Conflict-free') === true);
check('Web Share button absent when navigator.share unsupported', Array.from(doc.querySelectorAll('button')).every((b) => b.textContent?.trim() !== 'Share…'));

const copyBtn = Array.from(doc.querySelectorAll('button')).find((b) => b.textContent?.includes('Copy Link'))!;
check('Copy Link button present', !!copyBtn);
await act(async () => {
  copyBtn.click();
});
check('copied status shows "Schedule link copied!"', doc.body.textContent?.includes('Schedule link copied!') === true);

act(() => root.unmount());
console.log(`\n${pass} passed, ${fail} failed (share sheet)`);
process.exit(fail ? 1 : 0);
}
void main();
