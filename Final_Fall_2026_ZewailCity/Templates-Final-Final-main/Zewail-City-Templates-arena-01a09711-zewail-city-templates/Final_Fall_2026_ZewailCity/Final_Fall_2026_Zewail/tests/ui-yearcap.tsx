/**
 * Interaction test (real DOM, real clicks) for the NEW major → year flow, the credit-limit
 * note + enforcement, and the cross-year course browser.
 * Run via: npm run test:ui
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.Event = dom.window.Event;
g.IS_REACT_ACT_ENVIRONMENT = true;
// App reads matchMedia (theme) and localStorage at module/App init.
g.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
const store = new Map<string, string>();
g.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
(dom.window as unknown as Record<string, unknown>).matchMedia = g.matchMedia;

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';

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
const buttons = () => Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[];
const buttonByText = (text: string) => buttons().find((b) => b.textContent?.trim().includes(text));
const click = (el: HTMLElement) => act(() => el.click());

const root = createRoot(doc.getElementById('root')!);
act(() => {
  root.render(React.createElement(App));
});

/* ================= 1. major → year picker step ================= */
check('major picker shows first', doc.body.textContent!.includes('Choose Your Major'));
click(buttonByText('Data Science & AI')!);
check('year picker appears after picking a major', doc.body.textContent!.includes('Choose Your Year'));
check('all four year labels are shown', ['Year 1 (Freshman)', 'Year 2 (Sophomore)', 'Year 3 (Junior)', 'Year 4 (Senior)'].every((l) => doc.body.textContent!.includes(l)));
check('course picker NOT shown before a year is chosen', !doc.body.textContent!.includes('Courses this term'));

click(buttonByText('Year 3 (Junior)')!);
check('course picker appears scoped to Year 3 (DSAI 307 present, IT 205 absent)', doc.body.textContent!.includes('Courses this term') && doc.body.textContent!.includes('DSAI 307') && !doc.body.textContent!.includes('IT 205'));
check('shared CSAI 203 + CSAI 301 referenced in DSAI Year 3', doc.body.textContent!.includes('CSAI 203') && doc.body.textContent!.includes('CSAI 301'));

/* ================= 2. privacy-first credit-limit chooser ================= */
check('credit-limit chooser stays hidden until requested', !doc.body.textContent!.includes('Planning credit limit'));
check('default cap is 21 before any tier chosen', doc.body.textContent!.includes('21-credit limit'));
click(buttonByText('change limit')!);
check('manual chooser opens with privacy-first copy', doc.body.textContent!.includes('Planning credit limit') && doc.body.textContent!.includes('Your GPA is never requested or stored.'));
click(buttonByText('13 credits')!);
check('choosing 13 credits sets the cap and dismisses the chooser', doc.body.textContent!.includes('13-credit limit') && !doc.body.textContent!.includes('Planning credit limit'));
const persisted = () => dom.window.localStorage.getItem('zw-app-state-v2') ?? '';
check('nothing labeled as GPA is persisted', !persisted().toLowerCase().includes('gpa'));
check('persisted cap is the plain integer 13', persisted().includes('"creditCap":13'));

/* ================= 3. enforcement: 13-cap blocks the 5th 3-credit course ================= */
const tick = (code: string) => {
  const input = doc.querySelector(`input[aria-label="Register ${code}"]`) as HTMLInputElement;
  click(input);
  // Re-query: a rejected card remounts (shake retrigger), invalidating the old reference.
  return doc.querySelector(`input[aria-label="Register ${code}"]`) as HTMLInputElement;
};
['CSAI 203', 'CSAI 301', 'DSAI 307', 'DSAI 308'].forEach(tick); // 12 credits
check('4 courses register fine under the 13-cap', doc.body.textContent!.includes('12') && !doc.body.textContent!.includes('Remove a course first'));
const fifth = tick('MATH 303'); // 12 + 3 > 13 → must be rejected
check('5th course is rejected: checkbox stays unticked', fifth.checked === false);
check('rejection message shown', doc.body.textContent!.includes('This would put you over your 13-credit limit. Remove a course first.'));
check('rejected course card shakes', doc.querySelector('.course-card.shake') !== null);

/* untick one course, then the previously blocked course fits */
tick('DSAI 308'); // remove → 9 credits (removal always allowed)
const retry = tick('MATH 303');
check('after removing a course the blocked one can be added', retry.checked === true);

/* ================= 4. change-limit link reopens the tier choice ================= */
click(buttonByText('change limit')!);
check('change-limit reopens the chooser', doc.body.textContent!.includes('Planning credit limit'));
click(buttonByText('Over Load · 21 credits')!);
check('switching to Over Load activates the 21-cap', doc.body.textContent!.includes('21-credit limit'));

/* ================= 5. cross-year browser ================= */
click(buttonByText('Choose from another year')!);
check('cross-year browser opens listing other years of the SAME major', doc.body.textContent!.includes('Choose from another year') && doc.body.textContent!.includes('DSAI 456'));
const search = doc.querySelector('#cross-year-search') as HTMLInputElement;
check('search input present', !!search);
const crossTick = doc.querySelector('input[aria-label="Register DSAI 456 from Year 4 (Senior)"]') as HTMLInputElement;
click(crossTick);
check('cross-year course registers into the same PickState', crossTick.checked === true);
click(buttonByText('Done')!);
check('cross-year course appears in the main picker with a Year 4 badge', doc.body.textContent!.includes('DSAI 456') && doc.body.textContent!.includes('Year 4'));

/* ================= 6. changing year resets the cap tier ================= */
click(buttonByText('Change year')!);
click(buttonByText('Year 4 (Senior)')!);
check('changing year keeps the credit chooser hidden until requested', !doc.body.textContent!.includes('Planning credit limit'));
check('cap reset to the default 21 ceiling', doc.body.textContent!.includes('21-credit limit'));
check('Year 4 list shows the no-fixed-schedule Senior Project', doc.body.textContent!.includes('CSAI 498'));

/* ================= 7. no-fixed-schedule placeholder behaviour ================= */
const senior = tick('CSAI 498');
check('Senior Project is tickable', senior.checked === true);
check('placeholder shows the arranged-individually note, no option pickers', doc.body.textContent!.includes('No fixed schedule — arranged individually') && !doc.body.textContent!.includes('Pick a lecture time for CSAI 498'));
check('placeholder credits count toward the total (1 cr registered)', doc.body.textContent!.includes('1 credit registered'));
check('placeholder never appears as still-to-decide', !doc.body.textContent!.includes('Pick a lecture time for CSAI 498') && !doc.body.textContent!.includes('CSAI 498: pick all published components'));

act(() => root.unmount());
console.log(`\n${pass} passed, ${fail} failed (year picker + credit cap + cross-year browser)`);
process.exit(fail ? 1 : 0);
