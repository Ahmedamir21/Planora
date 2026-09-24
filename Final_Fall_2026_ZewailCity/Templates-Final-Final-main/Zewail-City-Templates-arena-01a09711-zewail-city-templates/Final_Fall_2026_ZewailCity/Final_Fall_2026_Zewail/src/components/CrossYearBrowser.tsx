import { useMemo, useState } from 'react';
import type { Major } from '../types';
import { COURSE_BY_ID } from '../data/courses';
import type { PickState } from '../lib/picks';

interface Props {
  major: Major;
  /** The year whose course list is currently active in the main picker. */
  currentYearId: string;
  picks: PickState;
  onToggle: (courseId: string, taking: boolean) => void;
  onClose: () => void;
  /** Credit-cap rejection message (same one the main picker shows), if any. */
  capNotice?: string | null;
  /** Course id whose row should shake after a rejected add, with a nonce to retrigger. */
  shake?: { courseId: string; nonce: number } | null;
}

/**
 * "Choose from another year" — browse every course of the SAME major across ALL of its
 * years and tick any of them into the exact same PickState the rest of the app uses.
 * This is purely a browsing surface: section picking, conflict detection, generation and
 * credits all run through the existing machinery once a course is ticked here.
 */
export function CrossYearBrowser({ major, currentYearId, picks, onToggle, onClose, capNotice, shake }: Props) {
  const [query, setQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: { courseId: string; yearId: string; yearLabel: string }[] = [];
    const seen = new Set<string>();

    major.years.forEach((year) => {
      year.courseIds.forEach((id) => {
        if (seen.has(id)) return;
        seen.add(id);
        out.push({ courseId: id, yearId: year.id, yearLabel: year.label });
      });
    });

    return out.filter(({ courseId, yearId }) => {
      if (yearFilter !== 'all' && yearId !== yearFilter) return false;

      const course = COURSE_BY_ID[courseId];
      if (!course) return false;

      if (!q) return true;

      return course.code.toLowerCase().includes(q) || course.name.toLowerCase().includes(q);
    });
  }, [major, query, yearFilter]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Browse courses from other years"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-b-none sm:rounded-2xl">
        <div className="flex items-center justify-between gap-2 border-b p-4" style={{ borderColor: 'var(--line)' }}>
          <div>
            <h2 className="text-[14.5px] font-bold tracking-tight">Choose from another year</h2>
            <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--muted)' }}>
              Every {major.title} course across Year 1–4 — tick one to add it to your normal course list.
            </p>
          </div>

          <button
            type="button"
            className="btn px-2.5 py-1.5"
            onClick={onClose}
            aria-label="Close cross-year browser"
          >
            ✕
          </button>
        </div>

        <div
          className="flex flex-wrap items-center gap-2 border-b p-3"
          style={{ borderColor: 'var(--line-soft)' }}
        >
          <label className="sr-only" htmlFor="cross-year-search">
            Search courses by code or name
          </label>

          <input
            id="cross-year-search"
            type="search"
            className="select min-w-[160px] flex-1 cursor-text"
            placeholder="Search by code or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div
            className="flex flex-wrap items-center gap-1 rounded-xl p-1"
            style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)' }}
            role="group"
            aria-label="Filter by year"
          >
            {[
              { id: 'all', label: 'All years' },
              ...major.years.map((y) => ({
                id: y.id,
                label: y.label.replace(/\s*\(.*\)$/, ''),
              })),
            ].map((chip) => {
              const active = yearFilter === chip.id;

              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setYearFilter(chip.id)}
                  aria-pressed={active}
                  className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
                  style={{
                    background: active ? 'var(--paper)' : 'transparent',
                    color: active ? 'var(--ink)' : 'var(--muted)',
                    border: active ? '1px solid var(--line)' : '1px solid transparent',
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {capNotice && (
          <p
            className="border-b px-4 py-2 text-[12px] font-semibold"
            style={{
              borderColor: 'var(--warn-line)',
              background: 'var(--warn-bg)',
              color: 'var(--warn)',
            }}
            role="alert"
          >
            {capNotice}
          </p>
        )}

        <div className="scroll-thin flex-1 space-y-1.5 overflow-y-auto p-3">
          {rows.length === 0 && (
            <p className="px-1 py-4 text-center text-[12px]" style={{ color: 'var(--muted)' }}>
              No courses match this search.
            </p>
          )}

          {rows.map(({ courseId, yearId, yearLabel }) => {
            const course = COURSE_BY_ID[courseId];
            const taking = !!picks[courseId];
            const isCurrentYear = yearId === currentYearId;
            const shaking = shake?.courseId === courseId;

            return (
              <label
                key={shaking ? `${courseId}:${shake!.nonce}` : courseId}
                className={`tap-row flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
                  shaking ? 'shake' : ''
                }`}
                style={{
                  borderColor: taking ? 'var(--accent)' : 'var(--line-soft)',
                  background: taking
                    ? 'color-mix(in srgb, var(--accent) 8%, var(--paper))'
                    : 'var(--surface)',
                }}
              >
                <input
                  type="checkbox"
                  className="tap-checkbox mt-0.5 flex-none accent-[var(--accent)]"
                  checked={taking}
                  onChange={(e) => onToggle(courseId, e.target.checked)}
                  aria-label={`Register ${course.code} from ${yearLabel}`}
                />

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className="mono text-[13px] font-bold tracking-tight"
                      style={{ color: `var(--c${course.c})` }}
                    >
                      {course.code}
                    </span>

                    {course.credits != null && <span className="pill">{course.credits} cr</span>}

                    <span
                      className="pill"
                      style={
                        isCurrentYear
                          ? undefined
                          : {
                              color: 'var(--accent)',
                              borderColor:
                                'color-mix(in srgb, var(--accent) 45%, var(--line))',
                            }
                      }
                    >
                      {yearLabel.replace(/\s*\(.*\)$/, '')}
                      {isCurrentYear ? ' · current' : ''}
                    </span>
                  </span>

                  <span
                    className="mt-0.5 block text-[12px] leading-snug"
                    style={{ color: 'var(--muted)' }}
                  >
                    {course.name}
                  </span>

                  {course.noFixedSchedule && (
                    <span
                      className="mt-0.5 block text-[11px] font-semibold"
                      style={{ color: 'var(--muted-2)' }}
                    >
                      No fixed schedule — arranged individually.
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>

        <div className="border-t p-3 text-right" style={{ borderColor: 'var(--line-soft)' }}>
          <button type="button" className="btn btn-tap" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
