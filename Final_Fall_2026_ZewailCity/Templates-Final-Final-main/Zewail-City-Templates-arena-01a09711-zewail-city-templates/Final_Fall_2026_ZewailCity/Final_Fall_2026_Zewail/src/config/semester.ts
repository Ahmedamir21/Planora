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

export const SEMESTER_CONFIG = {
  key: 'fall-2026-main',
  institution: 'Zewail City',
  brandName: 'Planora',
  plannerName: 'Schedule Planner',
  term: 'Fall',
  year: 2026,
  session: 'Main Session',
  version: '3.0',
  dataLastVerified: '2026-09-24',
  calendarStartDate: '2026-09-20',
  calendarEndDate: '2026-12-31',
  publicHostLabel: 'planora.vercel.app',
} as const;

export const TERM_LABEL = `${SEMESTER_CONFIG.term} ${SEMESTER_CONFIG.year}`;
export const TERM_SESSION_LABEL = `${TERM_LABEL} · ${SEMESTER_CONFIG.session}`;
export const TERM_SESSION_PAREN_LABEL = `${TERM_LABEL} (${SEMESTER_CONFIG.session})`;
export const PRODUCT_TITLE = `${SEMESTER_CONFIG.brandName} — ${TERM_LABEL} ${SEMESTER_CONFIG.plannerName}`;
export const SHARE_TITLE = `My ${TERM_LABEL} schedule · ${SEMESTER_CONFIG.brandName}`;
export const SHARE_TEXT = `Check out my ${TERM_LABEL} schedule on ${SEMESTER_CONFIG.brandName}.`;

export const DOCUMENT_TITLE = PRODUCT_TITLE;
export const DOCUMENT_DESCRIPTION = `${SEMESTER_CONFIG.brandName} is a student-built schedule planner. Choose your major, pick courses and sections, catch time conflicts instantly, compare schedules, and share your final plan.`;

export const CREATOR_CREDIT = 'Directed by Ahmed Amir & Youssef Taha (الريبات المشطشطين)';
