/** Day codes accepted from any persisted or URL-supplied state. */
export const VALID_DAYS_SAFE = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'] as const;

/** Meeting-type codes accepted from any persisted or URL-supplied state. */
export const VALID_TYPE_FILTERS = ['All', 'Lecture', 'Lab', 'Tutorial'] as const;

/** True only when `value` is one of the known type filters. */
export function isValidTypeFilter(value: unknown): value is string {
  return typeof value === 'string' && (VALID_TYPE_FILTERS as readonly string[]).includes(value);
}

/** Sanitizes a course filter: must be 'all' or a course id we actually know about. */
export function isValidCourseFilter(value: unknown): value is string {
  return value === 'all' || (typeof value === 'string' && value.length > 0 && /^[a-z0-9]+$/i.test(value));
}

/** Year ids accepted from any persisted or URL-supplied state. */
export const VALID_YEAR_IDS = ['y1', 'y2', 'y3', 'y4'] as const;

/** True only when `value` is one of the known year ids. */
export function isValidYearId(value: unknown): value is string {
  return typeof value === 'string' && (VALID_YEAR_IDS as readonly string[]).includes(value);
}
