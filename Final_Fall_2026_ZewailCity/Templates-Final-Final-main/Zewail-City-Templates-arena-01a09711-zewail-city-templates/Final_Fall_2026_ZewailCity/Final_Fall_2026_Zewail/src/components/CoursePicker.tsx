import { useState } from 'react';
import type { Course, MeetingType } from '../types';
import { type Pick, type PickState } from '../lib/picks';
import { mergeHiddenSummaries, optionStates, summarizeHidden } from '../lib/picks-parts/optionStates';
import type { SchedulePreferences } from '../lib/preferences';
import type { PlannerLocks } from '../lib/assistantControls';
import { CourseCard } from './course-picker/CourseCard';
import { KIND_ORDER } from './course-picker/kinds';

interface Props {
  courses: Course[];
  picks: PickState;
  /** Active instructor filter per course (the pills below). */
  instructorFilter: Record<string, number>;
  onInstructorFilter: (courseId: string, idx: number | null) => void;
  preferences?: SchedulePreferences;
  onChange: (courseId: string, pick: Pick) => void;
  onToggle: (courseId: string, taking: boolean) => void;
  onClearOne: (courseId: string) => void;
  /** "Year X" badge per course id, for courses added from another year of the major. */
  yearBadges?: Record<string, string>;
  /** Opens the cross-year course browser ("Choose from another year"). */
  onOpenCrossYear?: () => void;
  /** Credit-cap rejection message shown inline near the course list, if any. */
  capNotice?: string | null;
  /** Course whose card should shake after a rejected (over-cap) addition. */
  shake?: { courseId: string; nonce: number } | null;
  /** Desktop hover/focus bridge to the timetable. */
  onHoverCourse?: (courseId: string | null) => void;
  locks: PlannerLocks;
  onToggleCourseLock: (courseId: string) => void;
  onToggleComponentLock: (courseId: string, kind: MeetingType) => void;
  onReportIssue: (courseId: string) => void;
}

export function CoursePicker({
  courses,
  picks,
  instructorFilter,
  onInstructorFilter,
  preferences,
  onChange,
  onToggle,
  onClearOne,
  yearBadges,
  onOpenCrossYear,
  capNotice,
  shake,
  onHoverCourse,
  locks,
  onToggleCourseLock,
  onToggleComponentLock,
  onReportIssue,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [schOpen, setSchOpen] = useState(true);
  const [englOpen, setEnglOpen] = useState(true);
  const takenCourses = courses.filter((c) => picks[c.id]);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleCourses = normalizedSearch
    ? courses.filter(
        (c) =>
          c.code.toLowerCase().includes(normalizedSearch) ||
          c.name.toLowerCase().includes(normalizedSearch),
      )
    : courses;

  const currentYearCourses = visibleCourses.filter(
    (c) => !c.code.startsWith('SCH ') && !c.code.startsWith('ENGL ') && !yearBadges?.[c.id],
  );
  const schCourses = visibleCourses.filter((c) => c.code.startsWith('SCH '));
  const englCourses = visibleCourses.filter((c) => c.code.startsWith('ENGL '));
  const otherYearCourses = visibleCourses.filter(
    (c) => !c.code.startsWith('SCH ') && !c.code.startsWith('ENGL ') && !!yearBadges?.[c.id],
  );
  const selectedSchCount = schCourses.filter((c) => !!picks[c.id]).length;
  const selectedEnglCount = englCourses.filter((c) => !!picks[c.id]).length;

  const renderCourse = (course: Course) => (
    <CourseCard
      key={course.id}
      course={course}
      pick={picks[course.id]}
      takenCourses={takenCourses}
      picks={picks}
      pinnedInstructorIdx={instructorFilter[course.id] ?? null}
      onInstructorFilter={(idx) => onInstructorFilter(course.id, idx)}
      preferences={preferences}
      onChange={(next) => onChange(course.id, next)}
      onToggle={(taking) => onToggle(course.id, taking)}
      onClearOne={() => onClearOne(course.id)}
      yearBadge={yearBadges?.[course.id]}
      shakeNonce={shake?.courseId === course.id ? shake.nonce : null}
      onHoverCourse={onHoverCourse}
      locks={locks}
      onToggleCourseLock={() => onToggleCourseLock(course.id)}
      onToggleComponentLock={(kind) => onToggleComponentLock(course.id, kind)}
      onReportIssue={() => onReportIssue(course.id)}
    />
  );

  const overallSummary = mergeHiddenSummaries(
    takenCourses.flatMap((course) =>
      KIND_ORDER.map((kind) =>
        summarizeHidden(
          optionStates(course, kind, takenCourses, picks, {
            pinnedInstructorIdx: instructorFilter[course.id] ?? null,
            preferences,
          }),
        ),
      ),
    ),
  );

  return (
    <section className="panel no-print p-4 sm:p-5" aria-labelledby="picker-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="picker-heading" className="text-[13px] font-bold tracking-tight">
            Courses this term
          </h2>
          <p className="mt-1 max-w-[42ch] text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            Tick a course, then pick a time for each component it publishes — lecture and lab/tutorial may belong to
            different instructors; only real time clashes are rejected. Options that clash with a pick are disabled
            automatically — untick or change that pick and they come right back.
          </p>
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          {overallSummary.hidden > 0 && (
            <span
              className="pill flex-none"
              style={{
                color: overallSummary.conflicts > 0 ? 'var(--warn)' : 'var(--muted)',
                borderColor: overallSummary.conflicts > 0 ? 'var(--warn-line)' : 'var(--line)',
                background: overallSummary.conflicts > 0 ? 'var(--warn-bg)' : 'var(--surface)',
              }}
            >
              {overallSummary.hidden} hidden
              {overallSummary.conflicts > 0 ? ` • ${overallSummary.conflicts} conflict${overallSummary.conflicts > 1 ? 's' : ''}` : ''}
            </span>
          )}
          {onOpenCrossYear && (
            <button
              type="button"
              className="btn btn-tap px-2.5 py-1.5 text-[11px]"
              onClick={onOpenCrossYear}
              title="Browse and add courses from any other year of your major"
            >
              🗂 Choose from another year
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label className="sr-only" htmlFor="course-search">Search courses</label>
        <div className="course-search-wrap">
          <span aria-hidden>⌕</span>
          <input
            id="course-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by course code or name..."
            className="course-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="course-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear course search"
            >
              ×
            </button>
          )}
        </div>
        {normalizedSearch && (
          <p className="mt-1.5 text-[10.5px]" style={{ color: 'var(--muted-2)' }}>
            {visibleCourses.length} matching course{visibleCourses.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {capNotice && (
        <p
          className="mt-3 rounded-xl border px-3.5 py-2.5 text-[12px] font-semibold"
          style={{ borderColor: 'var(--warn-line)', background: 'var(--warn-bg)', color: 'var(--warn)' }}
          role="alert"
          aria-live="assertive"
        >
          {capNotice}
        </p>
      )}

      <div className="mt-4 space-y-4">
        {currentYearCourses.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-1">
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-2)' }}>
                  Current year courses
                </h3>
                <p className="text-[10.5px]" style={{ color: 'var(--muted-2)' }}>
                  {currentYearCourses.length} course{currentYearCourses.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            {currentYearCourses.map(renderCourse)}
          </section>
        )}

        {schCourses.length > 0 && (
          <section className="space-y-2.5">
            <button
              type="button"
              className="course-group-toggle"
              onClick={() => setSchOpen((v) => !v)}
              aria-expanded={normalizedSearch ? true : schOpen}
            >
              <span className="min-w-0 text-left">
                <span className="block text-[11px] font-bold uppercase tracking-[0.08em]">SCH electives</span>
                <span className="block text-[10.5px] font-medium" style={{ color: 'var(--muted-2)' }}>
                  {schCourses.length} available{selectedSchCount > 0 ? ` · ${selectedSchCount} selected` : ''}
                </span>
              </span>
              <span className="pill">{normalizedSearch || schOpen ? 'Hide' : 'Show'}</span>
            </button>
            {(normalizedSearch || schOpen) && schCourses.map(renderCourse)}
          </section>
        )}

        {englCourses.length > 0 && (
          <section className="space-y-2.5">
            <button
              type="button"
              className="course-group-toggle"
              onClick={() => setEnglOpen((v) => !v)}
              aria-expanded={normalizedSearch ? true : englOpen}
            >
              <span className="min-w-0 text-left">
                <span className="block text-[11px] font-bold uppercase tracking-[0.08em]">ENGL levels</span>
                <span className="block text-[10.5px] font-medium" style={{ color: 'var(--muted-2)' }}>
                  {englCourses.length} available{selectedEnglCount > 0 ? ` · ${selectedEnglCount} selected` : ''}
                </span>
              </span>
              <span className="pill">{normalizedSearch || englOpen ? 'Hide' : 'Show'}</span>
            </button>
            {(normalizedSearch || englOpen) && englCourses.map(renderCourse)}
          </section>
        )}
        {otherYearCourses.length > 0 && (
          <section className="space-y-2.5">
            <div className="px-1">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-2)' }}>
                Added from other years
              </h3>
            </div>
            {otherYearCourses.map(renderCourse)}
          </section>
        )}

        {visibleCourses.length === 0 && (
          <div className="panel-soft p-5 text-center">
            <p className="text-[12.5px] font-semibold">No courses match “{searchQuery}”.</p>
            <button type="button" className="btn btn-tap mt-3" onClick={() => setSearchQuery('')}>
              Clear search
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

