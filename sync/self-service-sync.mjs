import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEMESTER_DIR = path.join(ROOT, 'Final_Fall_2026_ZewailCity', 'Templates-Final-Final-main', 'Zewail-City-Templates-arena-01a09711-zewail-city-templates', 'Final_Fall_2026_ZewailCity', 'Final_Fall_2026_Zewail', 'src', 'semester');
const COURSES_URL = process.env.SELF_SERVICE_COURSES_URL || 'https://sisselfservice.zewailcity.edu.eg/PowerCampusSelfService/Registration/Courses';
const LOGIN_URL = process.env.SELF_SERVICE_LOGIN_URL || 'https://sisselfservice.zewailcity.edu.eg/PowerCampusSelfService/Home/LogIn';
const INGEST_URL = process.env.PLANORA_SYNC_INGEST_URL;
const INGEST_SECRET = process.env.PLANORA_SYNC_INGEST_SECRET;
const USERNAME = process.env.SELF_SERVICE_USERNAME;
const PASSWORD = process.env.SELF_SERVICE_PASSWORD;
const HEADLESS = process.env.SELF_SERVICE_HEADLESS !== 'false';
const RESULTS_SELECTOR = process.env.SELF_SERVICE_RESULTS_SELECTOR;
const SEARCH_SELECTOR = process.env.SELF_SERVICE_SEARCH_SELECTOR;
const END_59_IS_NEXT_HOUR = process.env.SELF_SERVICE_END_59_IS_NEXT_HOUR !== 'false';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function required(name, value) { if (!value) throw new Error(`Missing required environment variable ${name}.`); return value; }
function normaliseDay(value) {
  const key = String(value || '').trim().toLowerCase();
  return ({ sunday:'Sun', sun:'Sun', monday:'Mon', mon:'Mon', tuesday:'Tue', tue:'Tue', wednesday:'Wed', wed:'Wed', thursday:'Thu', thu:'Thu' })[key] || null;
}
function parseClock(value, allowEnd59 = false) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]); const minute = Number(match[2]); const meridiem = match[3].toUpperCase();
  if (hour < 1 || hour > 12 || minute > 59) return null;
  if (meridiem === 'AM') hour = hour === 12 ? 0 : hour; else hour = hour === 12 ? 12 : hour + 12;
  if (allowEnd59 && END_59_IS_NEXT_HOUR && minute === 59) return hour * 60 + 60;
  return hour * 60 + minute;
}
function parseMeetingText(text) {
  const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const subtype = text.match(/Subtype\s*:\s*(Lecture|Laboratory|Lab|Tutorial)\s*\|\s*Section\s*:\s*([^\n|]+)/i);
  const time = text.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
  const day = lines.find(line => normaliseDay(line));
  const roomMatch = text.match(/Room\s+([^\n]+)/i);
  const instructorIndex = lines.findIndex(line => /^\d+(?:\.\d+)?$/.test(line) || /^\d+(?:\.\d+)?\s+Credits$/i.test(line));
  const likelyInstructor = instructorIndex > 0 ? lines[instructorIndex - 1] : '';
  const title = text.match(/([A-Z]{2,}[A-Z0-9]*\s*\d{3})\s*:\s*([^\n]+)/i);
  if (!subtype || !time || !day || !title) return null;
  const start = parseClock(time[1]); const end = parseClock(time[2], true);
  if (start == null || end == null || end <= start) return null;
  const rawType = subtype[1].toLowerCase();
  const type = rawType === 'laboratory' || rawType === 'lab' ? 'Lab' : rawType === 'tutorial' ? 'Tutorial' : 'Lecture';
  const credits = text.match(/(\d+(?:\.\d+)?)\s+Credits?/i);
  const instructor = likelyInstructor && !/^\d/.test(likelyInstructor) ? likelyInstructor : 'Instructor Not Assigned';
  return { code:title[1].replace(/\s+/g,' ').trim().toUpperCase(), name:title[2].trim(), type, sec:subtype[2].trim(), day:normaliseDay(day), start, end, room:roomMatch ? roomMatch[1].trim() : '', instructor, credits:credits ? Number(credits[1]) : undefined, originalTime:`${time[1]} - ${time[2]}` };
}
function pickCardTexts(texts) {
  const unique = new Map();
  for (const text of texts) {
    const clean = String(text || '').replace(/\r/g,'').trim();
    if (/\bREGISTERED\b|\bMY\s+SCHEDULE\b/i.test(clean)) continue;
    if (!/Subtype\s*:/i.test(clean) || !/Section\s*:/i.test(clean) || !/\d{1,2}:\d{2}\s*[AP]M\s*-\s*\d{1,2}:\d{2}\s*[AP]M/i.test(clean)) continue;
    const parsed = parseMeetingText(clean);
    if (parsed) unique.set(`${parsed.code}|${parsed.type}|${parsed.sec}|${parsed.day}|${parsed.start}|${parsed.end}|${parsed.room}|${parsed.instructor}`, parsed);
  }
  return [...unique.values()];
}
async function login(page) {
  await page.goto(LOGIN_URL, { waitUntil:'domcontentloaded', timeout:45_000 });
  if (/requested URL was rejected|support ID/i.test(await page.locator('body').innerText().catch(()=>''))) throw new Error('Self-Service rejected the automation environment before login.');
  const username = page.getByLabel(/username|user name/i).first();
  if (await username.count() === 0) throw new Error('Could not find the username field safely.');
  await username.fill(USERNAME);
  let password = page.locator('input[type="password"]:visible').first();
  if (await password.count() === 0) {
    const next = page.getByRole('button', { name:/next|continue/i }).first();
    if (await next.count() === 0) throw new Error('Could not find the password field or a safe login Continue button.');
    await next.click();
    await page.waitForLoadState('domcontentloaded').catch(()=>{});
    await sleep(500);
    password = page.locator('input[type="password"]:visible').first();
  }
  if (await password.count() === 0) throw new Error('Could not find the password field safely.');
  await password.fill(PASSWORD);
  const signIn = page.getByRole('button', { name:/sign in|login|next|continue/i }).first();
  if (await signIn.count() === 0) throw new Error('Could not find the login button safely.');
  await signIn.click();
  await page.waitForLoadState('domcontentloaded').catch(()=>{});
  await sleep(1200);
  if (/incorrect|invalid|unable to sign|support ID|rejected/i.test(await page.locator('body').innerText().catch(()=>''))) throw new Error('Self-Service login failed or was rejected.');
}
async function searchCourse(page, code) {
  await page.goto(COURSES_URL, { waitUntil:'domcontentloaded', timeout:45_000 });
  const body = await page.locator('body').innerText().catch(()=>'');
  if (/requested URL was rejected|support ID/i.test(body)) throw new Error('Self-Service rejected the courses page.');

  const search = page.locator(SEARCH_SELECTOR).first();
  if (await search.count() === 0) throw new Error(\`Could not find the configured visible course search input for \${code}. Nothing was clicked.\`);
  await search.fill(code);
  await search.press('Enter');
  await page.waitForLoadState('networkidle', { timeout:20_000 }).catch(()=>{});
  await sleep(800);

  // Safety boundary: never guess which cards belong to the left results pane.
  required('SELF_SERVICE_RESULTS_SELECTOR', RESULTS_SELECTOR);
  const source = page.locator(RESULTS_SELECTOR).first();
  if (await source.count() === 0) throw new Error(\`Configured left-results container was not found for \${code}. Right-side schedule was not inspected.\`);

  // Read the blue course-title link inside the configured LEFT results pane only.
  // This is a read operation; the scraper never clicks the course link.
  const linkTexts = await source.locator('a').allInnerTexts();
  const escapedCode = code.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
  const titlePattern = new RegExp(\`^\\\\s*\${escapedCode}\\\\s*:\\\\s*\\\\S\`, 'i');
  const courseTitle = linkTexts.map(value => value.trim()).find(value => titlePattern.test(value)) || '';
  if (!courseTitle) throw new Error(\`Could not read the blue \${code}: Course Name link inside the configured left-results pane. Nothing was clicked.\`);

  const cards = source.locator('article, li, [class*="card"], [class*="Card"], [role="article"]');
  const texts = await cards.evaluateAll(nodes => nodes.map(node => node.innerText || '').filter(Boolean));
  const rawTexts = texts.length ? texts : [await source.innerText()];
  const withTrustedTitle = rawTexts.map(text => new RegExp(escapedCode, 'i').test(text) && /:\\s*[^\\n]+/.test(text) ? text : \`\${courseTitle}\\n\${text}\`);
  return pickCardTexts(withTrustedTitle);
}

function meetingCount(course) {
  let total = 0;
  for (const teacher of course?.instructors || []) total += (teacher.lectures?.length || 0) + (teacher.labs?.length || 0) + (teacher.tutorials?.length || 0);
  return total;
}
function mergeInto(base, records, warnings) {
  const result = [];
  for (const course of base) {
    const rows = records.filter(row => row.code === course.code);
    if (!rows.length) { warnings.push(`${course.code}: no Self-Service results; existing data preserved.`); result.push(course); continue; }
    const byInstructor = new Map();
    for (const row of rows) {
      const key = row.instructor || 'Instructor Not Assigned';
      if (!byInstructor.has(key)) byInstructor.set(key, { name:key, ...(key === 'Instructor Not Assigned' ? { unassigned:true } : {}), lectures:[], labs:[], tutorials:[] });
      const group = byInstructor.get(key), bucket = row.type === 'Lecture' ? group.lectures : row.type === 'Lab' ? group.labs : group.tutorials;
      bucket.push({ type:row.type, sec:row.sec, day:row.day, start:row.start, end:row.end, room:row.room });
    }
    if (rows.length < meetingCount(course)) warnings.push(`${course.code}: parsed ${rows.length} sections vs ${meetingCount(course)} currently published; review carefully.`);
    const next = { ...course, name:rows[0].name || course.name, instructors:[...byInstructor.values()] };
    delete next.awaitingSource;
    delete next.noFixedSchedule;
    const creditValues = rows.map(row=>row.credits).filter(value=>Number.isFinite(value) && value > 0);
    if (creditValues.length) next.credits = Math.max(...creditValues);
    result.push(next);
  }
  const baseCodes = new Set(base.map(course=>course.code));
  for (const code of new Set(records.map(row=>row.code))) if (!baseCodes.has(code)) warnings.push(`${code}: found in Self-Service but not in this Planora catalog; not added automatically.`);
  return result;
}
async function main() {
  required('SELF_SERVICE_USERNAME', USERNAME);
  required('SELF_SERVICE_PASSWORD', PASSWORD);
  required('SELF_SERVICE_RESULTS_SELECTOR', RESULTS_SELECTOR);
  required('SELF_SERVICE_SEARCH_SELECTOR', SEARCH_SELECTOR);
  required('PLANORA_SYNC_INGEST_URL', INGEST_URL);
  required('PLANORA_SYNC_INGEST_SECRET', INGEST_SECRET);

  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless:HEADLESS });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  try {
    await login(page);
    const courses = JSON.parse(await fs.readFile(path.join(SEMESTER_DIR,'courses.json'),'utf8'));
    const sch = JSON.parse(await fs.readFile(path.join(SEMESTER_DIR,'sch.json'),'utf8'));
    const all = [...courses, ...sch], warnings = [], records = [];
    const requestedRaw = required('PLANORA_COURSE_CODES', process.env.PLANORA_COURSE_CODES);
    const requested = [...new Set(requestedRaw.split(',').map(value=>value.trim().toUpperCase()).filter(Boolean))];
    if (!requested.length || requested.length > 3) throw new Error('First-test safety limit: provide 1 to 3 explicit PLANORA_COURSE_CODES only.');
    const knownCodes = new Set(all.map(course => course.code));
    const unknown = requested.filter(code => !knownCodes.has(code));
    if (unknown.length) throw new Error(`Unknown Planora course code(s): ${unknown.join(', ')}.`);
    for (const code of requested) {
      const rows = await searchCourse(page, code);
      records.push(...rows);
      if (!rows.length) warnings.push(`${code}: no parseable course cards found.`);
      await sleep(250);
    }
    const nextCourses = mergeInto(courses, records, warnings), nextSch = mergeInto(sch, records, warnings);
    const payload = { source:`Self-Service daily agent · ${new Date().toISOString().slice(0,10)}`, startedAt, fetchedAt:new Date().toISOString(), agentWarnings:[...new Set(warnings)].slice(0,100), dataset:{ courses:nextCourses, sch:nextSch } };
    const response = await fetch(INGEST_URL, { method:'POST', headers:{ Authorization:`Bearer ${INGEST_SECRET}`, 'Content-Type':'application/json' }, body:JSON.stringify(payload) });
    const body = await response.text();
    if (!response.ok) throw new Error(`Planora ingest failed (${response.status}): ${body.slice(0,1000)}`);
    console.log(JSON.stringify({ ok:true, records:records.length, warnings:payload.agentWarnings.length, ingest:JSON.parse(body) }, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; });
