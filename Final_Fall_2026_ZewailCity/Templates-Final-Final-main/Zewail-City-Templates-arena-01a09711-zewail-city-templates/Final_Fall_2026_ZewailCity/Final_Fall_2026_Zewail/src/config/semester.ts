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
  plannerName: 'Schedule Builder',
  term: 'Fall',
  year: 2026,
  session: 'Main Session',
  version: '2.1',
  dataLastVerified: '2026-09-24',
  calendarStartDate: '2026-09-20',
  calendarEndDate: '2026-12-31',
  publicHostLabel: 'fall-2026-zewail-city.vercel.app',
} as const;

export const TERM_LABEL = `${SEMESTER_CONFIG.term} ${SEMESTER_CONFIG.year}`;
export const TERM_SESSION_LABEL = `${TERM_LABEL} · ${SEMESTER_CONFIG.session}`;
export const TERM_SESSION_PAREN_LABEL = `${TERM_LABEL} (${SEMESTER_CONFIG.session})`;
export const PRODUCT_TITLE = `${SEMESTER_CONFIG.institution} — ${TERM_LABEL} ${SEMESTER_CONFIG.plannerName}`;
export const SHARE_TITLE = `My ${TERM_LABEL} schedule`;
export const SHARE_TEXT = `Check out my ${SEMESTER_CONFIG.institution} ${TERM_LABEL} schedule.`;

export const DOCUMENT_TITLE = PRODUCT_TITLE;
export const DOCUMENT_DESCRIPTION = `${PRODUCT_TITLE}. Choose your major, pick courses and sections, catch time conflicts instantly, and share your finished schedule with a link.`;

export const CREATOR_CREDIT = 'Directed by Ahmed Amir & Youssef Taha (الريبات المشطشطين)';
