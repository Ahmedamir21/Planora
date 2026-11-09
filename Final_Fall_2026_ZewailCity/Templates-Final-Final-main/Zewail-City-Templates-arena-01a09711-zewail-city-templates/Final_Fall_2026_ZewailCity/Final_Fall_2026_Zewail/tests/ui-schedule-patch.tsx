import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { AdminSchedulePatch } from '../src/components/AdminSchedulePatch';
import courses from '../src/semester/courses.json';
import sch from '../src/semester/sch.json';
import type { Course } from '../src/types';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
const g = globalThis as Record<string, unknown>;
g.window = dom.window; g.document = dom.window.document;
g.Node = dom.window.Node; g.HTMLElement = dom.window.HTMLElement;
g.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const doc = dom.window.document, root = createRoot(doc.getElementById('root')!);
const original = { 'courses.json': courses as Course[], 'sch.json': sch as Course[] };
const calls: string[] = [];
const schCourse = sch.find(course => course.instructors.some(i => i.lectures.length))!;
const schSec = schCourse.instructors.flatMap(i => i.lectures)[0].sec;
act(() => root.render(<AdminSchedulePatch published={original}
  readDraft={async file => ({ revision: `${file}-revision`, content: JSON.stringify(original[file]) })}
  saveDraft={async (file, content, revision, source) => {
    if (revision !== `${file}-revision` || source !== 'Self-Service Fall 2026 Main') throw Error('Lost revision or source');
    const data = JSON.parse(content) as Course[];
    if (!data.every(course => original[file].some(previous => previous.id === course.id))) throw Error('New course invented');
    calls.push(file);
  }} onSaved={() => {}} unsavedEditor={false} />));

function type(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = input instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => { setter.call(input, value); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
}
const buttons = () => Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[];
const click = async (text: string) => {
  const button = buttons().find(item => item.textContent?.includes(text));
  if (!button) throw Error(`Missing button: ${text}`);
  await act(async () => { button.click(); await Promise.resolve(); });
};
type(doc.querySelector('textarea')!, `courseCode,subtype,section,day,start,end,room\nCSAI 205,Lecture,03,Tue,10:00,12:00,G090-B\n${schCourse.code},Lecture,${schSec},Wed,08:00,10:00,G019-B`);
await click('Preview times and rooms against both drafts');
if (!doc.body.textContent?.includes('Read 2 · Applied 2 · Unchanged 0 · Excluded 0')) throw Error('Both files were not previewed');
if (!buttons().find(item => item.textContent?.includes('Save courses.json private draft'))?.disabled) throw Error('Save must require a source');
type(doc.querySelector('input[placeholder="Checked against Self-Service Fall 2026 Main"]')!, 'Self-Service Fall 2026 Main');
await click('Save courses.json private draft');
await click('Save sch.json private draft');
if (calls.join(',') !== 'courses.json,sch.json') throw Error('Both private draft saves were not recorded separately');
act(() => root.unmount());
console.log('Admin schedule patch preview and separate private draft saves OK');
