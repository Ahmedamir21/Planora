import type { ComboMetrics, Course, Day, Instructor, Meeting, Pairing } from '../../types';

export interface ScheduleCourseEntry {
  course: Course;
  instructor: Instructor;
  instructorIdx: number;
  pairing: Pairing;
}

export interface DaySpan {
  day: Day;
  free: boolean;
  label: string;
}

export interface GeneratedSchedule {
  id: string;
  perCourse: ScheduleCourseEntry[];
  meetings: Meeting[];
  metrics: ComboMetrics;
  credits: number;
  scorePercent: number;
  keepFreeViolations: Day[];
  maxHoursViolationDays: Day[];
  daySpans: DaySpan[];
  /**
   * Longest single day in this schedule, in exact class minutes (end − start summed per day).
   * Uses real durations only — no padding — so 10:00–12:00 is exactly 2 hours.
   */
  maxDayMinutes: number;
}

export interface BestScheduleReport {
  schedules: GeneratedSchedule[];
  totalValid: number;
  /** True when the node budget was hit — the pool is then the best found so far, not exhaustive. */
  truncated: boolean;
  /** True when the search stopped early because a perfect-scoring pool was already full. */
  earlyExit: boolean;
  /**
   * Courses with NO viable candidate at all. Split into two distinct reasons because they
   * need different messages: a course may genuinely publish no sections, or it may publish
   * sections that are all excluded by the student's hard constraints. Collapsing these used
   * to produce a "required constraints" error with an empty constraint list.
   */
  noSections: { courseId: string; code: string }[];
  /** Courses that DO publish sections, but every section violates a hard constraint. */
  blockedByHard: { courseId: string; code: string }[];
  /** Human-readable list of the hard constraints currently configured. */
  unsatisfiableHard: string[];
  /** True only when hard constraints were requested AND at least one valid schedule satisfies them. */
  hardFeasible: boolean;
}
