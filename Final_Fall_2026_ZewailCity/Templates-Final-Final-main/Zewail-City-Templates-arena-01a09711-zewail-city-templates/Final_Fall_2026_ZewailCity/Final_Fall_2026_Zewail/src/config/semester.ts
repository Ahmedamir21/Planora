/**
 * Change this file when preparing a new semester.
 *
 * Course/section/instructor data lives in src/data/.
 * Product logic should never hard-code a semester name.
 */
/**
 * Pre-semester-key share links/local state were all created for Fall 2026.
 * Keep this constant unchanged forever; it lets future terms reject old
 * untagged state safely instead of interpreting it against new data.
 */
export const LEGACY_UNTAGGED_SEMESTER_KEY = 'fall-2026-main';

import semesterData from '../semester/semester.json';
export const SEMESTER_CONFIG = semesterData;

export const TERM_LABEL = `${SEMESTER_CONFIG.term} ${SEMESTER_CONFIG.year}`;
export const TERM_SESSION_LABEL = `${TERM_LABEL} · ${SEMESTER_CONFIG.session}`;
export const TERM_SESSION_PAREN_LABEL = `${TERM_LABEL} (${SEMESTER_CONFIG.session})`;
export const PRODUCT_TITLE = `Planora — ${TERM_LABEL} Student Schedule Planner`;
export const SHARE_TITLE = `My ${TERM_LABEL} schedule`;
export const SHARE_TEXT = `Check out my ${TERM_LABEL} schedule on Planora.`;

export const DOCUMENT_TITLE = PRODUCT_TITLE;
export const DOCUMENT_DESCRIPTION = `Planora is a student-built schedule planner for choosing courses and sections, detecting conflicts, comparing schedules, and sharing the final plan.`;

export const CREATOR_CREDIT = 'Directed by Ahmed Amir & Youssef Taha (الريبات المشطشطين)';
