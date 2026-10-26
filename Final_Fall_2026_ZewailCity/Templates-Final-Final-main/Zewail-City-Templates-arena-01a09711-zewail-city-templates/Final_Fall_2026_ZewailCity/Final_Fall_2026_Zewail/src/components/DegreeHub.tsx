import { useEffect, useMemo, useState } from 'react';
import { MAJORS, MAJOR_BY_ID } from '../data/majors';
import { COURSE_BY_ID } from '../data/courses';

type Props = { majorId: string | null; onClose: () => void };
type ProgressByMajor = Record<string, string[]>;

const STORAGE_KEY = 'planora-degree-progress-v1';

function readProgress(): ProgressByMajor {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([id, courses]) => [
      id,
      Array.isArray(courses) ? courses.filter((course): course is string => typeof course === 'string') : [],
    ]));
  } catch {
    return {};
  }
}

export function DegreeHub({ majorId, onClose }: Props) {
  const [selectedMajorId, setSelectedMajorId] = useState(majorId && MAJOR_BY_ID[majorId] ? majorId : MAJORS[0]?.id ?? '');
  const [progressByMajor, setProgressByMajor] = useState<ProgressByMajor>(readProgress);
  const major = MAJOR_BY_ID[selectedMajorId];

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progressByMajor));
    } catch {
      // Keep the current session usable if local storage is unavailable.
    }
  }, [progressByMajor]);

  const allCourseIds = useMemo(() => {
    if (!major) return [];
    return [...new Set(major.years.flatMap((year) => year.courseIds).filter((id) => !!COURSE_BY_ID[id]))];
  }, [major]);
  const completed = new Set(progressByMajor[selectedMajorId] ?? []);
  const completedCount = allCourseIds.filter((id) => completed.has(id)).length;
  const percent = allCourseIds.length ? Math.round((completedCount / allCourseIds.length) * 100) : 0;

  const toggleCourse = (courseId: string, checked: boolean) => {
    setProgressByMajor((current) => {
      const next = new Set(current[selectedMajorId] ?? []);
      if (checked) next.add(courseId);
      else next.delete(courseId);
      return { ...current, [selectedMajorId]: [...next] };
    });
  };

  return (
    <div className="fixed inset-0 z-[130] overflow-y-auto bg-[var(--bg)] p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="My Degree">
      <div className="mx-auto max-w-[1200px]">
        <header className="panel mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--accent)' }}>Planora · Academic roadmap</p>
            <h2 className="mt-1 text-2xl font-extrabold">My Degree</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Explore the published course plan across all four years and track your own progress.</p>
          </div>
          <button type="button" className="btn" onClick={onClose}>Back to planner</button>
        </header>

        <section className="panel mb-4 p-4">
          <label htmlFor="degree-major" className="mb-2 block text-xs font-bold">Major</label>
          <select id="degree-major" className="select max-w-md" value={selectedMajorId} onChange={(event) => setSelectedMajorId(event.target.value)}>
            {MAJORS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          {major && (
            <div className="mt-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{major.title}</p>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>{major.subtitle}</p>
                </div>
                <p className="text-sm font-bold">{completedCount} / {allCourseIds.length} courses · {percent}%</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }} role="progressbar" aria-label="Degree progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: 'var(--accent-fill)' }} />
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--muted-2)' }}>Progress is self-tracked on this device; it is not an official university transcript.</p>
            </div>
          )}
        </section>

        {!major ? <section className="panel p-5">No curriculum is available for this major yet.</section> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {major.years.map((year) => {
              const ids = [...new Set(year.courseIds)].filter((id) => !!COURSE_BY_ID[id]);
              const yearDone = ids.filter((id) => completed.has(id)).length;
              return (
                <section key={year.id} className="panel p-3 sm:p-4">
                  <div className="mb-3 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
                    <h3 className="text-sm font-extrabold">{year.label}</h3>
                    <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{yearDone} of {ids.length} completed</p>
                  </div>
                  <div className="space-y-2">
                    {ids.map((id) => {
                      const course = COURSE_BY_ID[id];
                      const checked = completed.has(id);
                      return (
                        <label key={id} className="flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 transition-colors" style={{ borderColor: checked ? 'var(--ok)' : 'var(--line)', background: checked ? 'color-mix(in srgb, var(--ok) 9%, var(--paper))' : 'var(--paper)' }}>
                          <input className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-fill)]" type="checkbox" checked={checked} onChange={(event) => toggleCourse(id, event.target.checked)} />
                          <span className="min-w-0">
                            <span className="block text-xs font-bold">{course.code}</span>
                            <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: 'var(--muted)' }}>{course.name}</span>
                          </span>
                        </label>
                      );
                    })}
                    {ids.length === 0 && <p className="text-xs" style={{ color: 'var(--muted)' }}>Course plan not published yet.</p>}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
