/**
 * Interaction test for the Maximum Hours Per Day control (real DOM, real clicks).
 * Spec under test: ONE normal press on the button opens the hour menu (options are NOT
 * permanently visible); ONE normal click on a value selects it, closes the menu and shows
 * it on the button; "No limit" clears back to the no-maximum state; the value flows into
 * the existing preferences state; hard/soft behavior and the rest of the app are unchanged.
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

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SchedulePreferencesPanel } from '../src/components/SchedulePreferences';
import { DEFAULT_PREFERENCES, type SchedulePreferences } from '../src/lib/preferences';

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
let lastChange: SchedulePreferences | null = null;
let lastGen: SchedulePreferences | null = null;
let root = createRoot(doc.getElementById('root')!);
let mounted = true;

/** Full unmount between sections — mirrors the real modal lifecycle (fresh internal state each open). */
function openPanel(prefs: SchedulePreferences): void {
  if (mounted) {
    act(() => root.unmount());
    mounted = false;
  }
  root = createRoot(doc.getElementById('root')!);
  mounted = true;
  act(() => {
    root.render(
      React.createElement(SchedulePreferencesPanel, {
        open: true,
        onClose: () => {},
        preferences: prefs,
        onChange: (p: SchedulePreferences) => (lastChange = p),
        onGenerate: (p: SchedulePreferences) => (lastGen = p),
      }),
    );
  });
}

const q = (sel: string) => doc.querySelector(sel);
const trigger = () => q('button[aria-haspopup="listbox"]') as HTMLElement | null;
const options = () => Array.from(doc.querySelectorAll('[role="option"]')) as HTMLElement[];
const optionByLabel = (label: string) => options().find((o) => o.textContent?.trim().replace(/\s*✓$/, '') === label);
const section = () => trigger()!.closest('section') as HTMLElement;
const hardInput = () => section().querySelector('input[type="checkbox"]') as HTMLInputElement;
const button = (label: string) => Array.from(doc.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLElement;

function click(el: HTMLElement): void {
  act(() => {
    el.click(); // exactly one standard activation event — what a mouse click or mobile tap produces
  });
}

/* ================= 1. closed by default: options are NOT permanently visible ================= */
openPanel(DEFAULT_PREFERENCES);
check('single trigger button exists', !!trigger());
check('no hour options shown before pressing the button', options().length === 0);
check('button shows the empty state as "Maximum Hours Per Day: No limit"', trigger()!.textContent === 'Maximum Hours Per Day: No limit');
check('button announces it has a menu', trigger()!.getAttribute('aria-haspopup') === 'listbox' && trigger()!.getAttribute('aria-expanded') === 'false');
check('still no native <select> in this control', section().querySelector('select') === null);
check('still no drag-based <input type="range"> in the panel', q('input[type="range"]') === null);
check('no long-press/hold handling — plain click activation only', !section().innerHTML.includes('onPointer') && !section().innerHTML.includes('onTouch') && !section().innerHTML.includes('onContextMenu'));
check('trigger is touch-friendly (btn-tap)', trigger()!.className.includes('btn-tap'));
check('hard toggle disabled while no limit is set (unchanged logic)', hardInput().disabled === true);

/* ================= 2. ONE press opens the menu ================= */
click(trigger()!);
check('one click opens the menu', options().length === 10); // No limit + 2…10h
check('aria-expanded flips to true', trigger()!.getAttribute('aria-expanded') === 'true');
check('menu keeps the existing value set: No limit + 2…10 hours', (() => {
  const labels = options().map((o) => o.textContent!.trim().replace(/\s*✓$/, ''));
  return JSON.stringify(labels) === JSON.stringify(['No limit', '2 hours', '3 hours', '4 hours', '5 hours', '6 hours', '7 hours', '8 hours', '9 hours', '10 hours']);
})());
check('"No limit" marked selected in the opened menu', optionByLabel('No limit')!.getAttribute('aria-selected') === 'true');
check('every option is a full-width tap-friendly row (btn-tap)', options().every((o) => o.className.includes('btn-tap') && o.tagName === 'BUTTON'));

/* ================= 3. ONE click on a value selects, closes, and shows on the button ================= */
click(optionByLabel('5 hours')!);
check('menu closes after selecting', options().length === 0);
check('button shows the selected value only', trigger()!.textContent === 'Maximum Hours Per Day: 5 hours');
check('selecting a value immediately enables the hard toggle', hardInput().disabled === false);
click(trigger()!);
check('reopening marks 5 hours selected with the check mark', optionByLabel('5 hours')!.getAttribute('aria-selected') === 'true' && optionByLabel('5 hours')!.textContent!.includes('✓'));
click(trigger()!); // pressing the button again toggles the menu closed
check('pressing the button again toggles the menu closed', options().length === 0);

/* ================= 4. commit into the EXISTING preferences state ================= */
click(trigger()!);
click(hardInput());
check('hard checkbox toggles as before', hardInput().checked === true);
click(button('Save only'));
check('Save commits maxHoursPerDay: 5 into preferences', lastChange !== null && lastChange.maxHoursPerDay === 5);
check('Save commits maxHoursHard: true unchanged', lastChange !== null && lastChange.maxHoursHard === true);
check('unrelated preference fields untouched', lastChange !== null && JSON.stringify(lastChange.preferredDays) === '[]' && lastChange.preferredStart === DEFAULT_PREFERENCES.preferredStart && lastChange.timeRangeHard === false);

/* reopening reflects the stored state — same number|null representation */
lastChange = null;
openPanel({ ...DEFAULT_PREFERENCES, maxHoursPerDay: 5, maxHoursHard: true });
check('re-opened panel shows stored value on the button', trigger()!.textContent === 'Maximum Hours Per Day: 5 hours');
check('re-opened panel shows the hard flag checked', hardInput().checked === true);

/* ================= 5. "No limit" clears back to the no-maximum state ================= */
click(trigger()!);
click(optionByLabel('No limit')!);
check('"No limit" clears the value on the button', trigger()!.textContent === 'Maximum Hours Per Day: No limit');
check('"No limit" disables the hard toggle again', hardInput().disabled === true);
lastChange = null;
lastGen = null;
click(button('Save & Generate'));
check('No limit commits null to preferences', lastChange !== null && lastChange.maxHoursPerDay === null);

/* ================= 6. soft mode + generator wiring unchanged ================= */
lastChange = null;
lastGen = null;
openPanel(DEFAULT_PREFERENCES);
check('fresh defaults: hard toggle disabled until a value exists', hardInput().disabled === true);
click(trigger()!);
click(optionByLabel('4 hours')!);
check('selecting 4 hours shows it on the button', trigger()!.textContent === 'Maximum Hours Per Day: 4 hours');
click(button('Save & Generate'));
check('single click on 4 hours then Save & Generate → generator receives exactly 4', lastGen !== null && lastGen.maxHoursPerDay === 4);
check('soft mode preserved: maxHoursHard stays false unless ticked', lastGen !== null && lastGen.maxHoursHard === false);

/* ================= 7. Escape and outside-press only dismiss the menu, never the modal ================= */
lastChange = null;
openPanel({ ...DEFAULT_PREFERENCES, maxHoursPerDay: 6 });
click(trigger()!);
act(() => {
  trigger()!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
});
check('Escape closes just the menu', options().length === 0);
check('Escape kept the settings modal open', q('[role="dialog"][aria-label="Schedule preferences"]') !== null);
click(trigger()!);
act(() => {
  doc.body.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })); // a press outside the menu
});
check('a press outside the menu closes it (touch + mouse)', options().length === 0);

if (mounted) act(() => root.unmount());
console.log(`\n${pass} passed, ${fail} failed (max-hours dropdown interaction)`);
process.exit(fail ? 1 : 0);
