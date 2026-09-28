import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { AdminCourseEditor } from '../src/components/AdminCourseEditor';
import courses from '../src/semester/courses.json';
import type { Course } from '../src/types';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
let draft = structuredClone(courses) as Course[];
const root = createRoot(dom.window.document.getElementById('root')!);
const render = () => root.render(<AdminCourseEditor courses={draft} onChange={next => { draft = next; render(); }} />);
act(render);

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
const doc = dom.window.document;
const search = doc.querySelector('input[aria-label="Search course to edit"]') as HTMLInputElement;
act(() => search.focus());
type(search, 'csai205');
let options = Array.from(doc.querySelectorAll('[role="option"]')) as HTMLButtonElement[];
if (options.length !== 1 || !options[0].textContent?.includes('CSAI 205')) throw Error('Code without spaces should match CSAI 205');
type(search, 'data structures');
options = Array.from(doc.querySelectorAll('[role="option"]')) as HTMLButtonElement[];
if (options.length !== 1 || !options[0].textContent?.includes('CSAI 201')) throw Error('Course name search should match Data Structures');
act(() => options[0].click());
if (!doc.body.textContent?.includes('Internal ID: csai201')) throw Error('Picking a search result should open its editor');
const nameField = Array.from(doc.querySelectorAll('input')).find(input => input.parentElement?.textContent?.includes('Course name'))!;
type(nameField, 'Data Structures (reviewed)');
if (draft.find(course => course.id === 'csai201')?.name !== 'Data Structures (reviewed)') throw Error('Course edit was not staged');
if (!doc.body.textContent?.includes('Change is only in this browser')) throw Error('Save guidance is missing');
act(() => root.unmount());
console.log('Admin course search by code/name and draft guidance OK');
