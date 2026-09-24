/* Headless smoke test: render the full App server-side and fail on any thrown error. */
// @ts-expect-error shim
globalThis.window = globalThis;
// @ts-expect-error shim
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
// @ts-expect-error shim
globalThis.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
// @ts-expect-error shim
globalThis.addEventListener = () => {};
// @ts-expect-error shim
const search = process.env.SSR_SEARCH ?? '';
globalThis.location = { href: 'http://localhost:5173/' + search, search, hash: '' };
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from '../src/App';

const html = renderToString(React.createElement(App));
const want = ['Planora', 'Major', 'Fall 2026'];
for (const w of want) {
  if (!html.includes(w)) {
    console.error('SSR missing expected text:', w);
    process.exit(1);
  }
}
console.log('SSR render OK —', html.length, 'chars of markup, no exceptions');
if (process.env.SSR_EXPECT_PLAN === '1') {
  for (const w of ['Credits Dashboard', 'PHYS 104', 'CSAI 203']) {
    if (!html.includes(w)) { console.error('plan render missing:', w); process.exit(1); }
  }
  console.log('shared-URL plan restored and rendered through the full App tree');
}
