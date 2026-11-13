import { useEffect, useMemo, useRef, useState } from 'react';
import type { Course } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  courses: Course[];
  onSelectCourse: (courseId: string) => void;
  onBestSchedule: () => void;
  onPreferences: () => void;
  onShare: () => void;
}

export function CommandPalette({
  open,
  onClose,
  courses,
  onSelectCourse,
  onBestSchedule,
  onPreferences,
  onShare,
}: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      courses
        .filter((c) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
        .slice(0, 8),
    [courses, q],
  );

  if (!open) return null;

  const actions = [
    { label: 'Generate / view Best Schedule', hint: 'Best Schedule', run: onBestSchedule },
    { label: 'Open Schedule Preferences', hint: 'Preferences', run: onPreferences },
    { label: 'Share current schedule', hint: 'Share', run: onShare },
  ].filter((a) => !q || a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q));

  return (
    <div
      className="fixed inset-0 z-[140] flex items-start justify-center bg-black/55 px-3 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search courses and actions"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="panel command-palette w-full max-w-[640px] overflow-hidden">
        <div className="border-b p-3" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-2 rounded-xl border px-3" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
            <span aria-hidden style={{ color: 'var(--muted)' }}>⌕</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent py-3 text-[14px] outline-none"
              placeholder="Search courses or actions..."
              aria-label="Search courses or actions"
            />
            <span className="pill hidden sm:inline-flex">Esc</span>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length > 0 && (
            <section>
              <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-2)' }}>
                Courses
              </p>
              {filtered.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  className="command-row"
                  onClick={() => {
                    onSelectCourse(course.id);
                    onClose();
                  }}
                >
                  <span className="mono font-bold" style={{ color: `var(--c${course.c})` }}>{course.code}</span>
                  <span className="min-w-0 flex-1 truncate text-left">{course.name}</span>
                  {course.credits != null && <span className="pill">{course.credits} cr</span>}
                </button>
              ))}
            </section>
          )}

          {actions.length > 0 && (
            <section className={filtered.length > 0 ? 'mt-2 border-t pt-2' : ''} style={{ borderColor: 'var(--line-soft)' }}>
              <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-2)' }}>
                Actions
              </p>
              {actions.map((action) => (
                <button
                  key={action.hint}
                  type="button"
                  className="command-row"
                  onClick={() => {
                    action.run();
                    onClose();
                  }}
                >
                  <span className="w-6 text-center" aria-hidden>✦</span>
                  <span className="flex-1 text-left">{action.label}</span>
                  <span className="pill">{action.hint}</span>
                </button>
              ))}
            </section>
          )}

          {filtered.length === 0 && actions.length === 0 && (
            <p className="p-6 text-center text-[12px]" style={{ color: 'var(--muted)' }}>
              No matching course or action.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
