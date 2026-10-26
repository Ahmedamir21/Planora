import { useEffect, useMemo, useState } from 'react';
import { MAJORS, MAJOR_BY_ID } from '../data/majors';
import { COURSE_BY_ID } from '../data/courses';

type Props = { majorId: string | null; onClose: () => void };
type ProgressByMajor = Record<string, string[]>;
type DetailTab = 'course' | 'prerequisites';

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
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('course');
  const major = MAJOR_BY_ID[selectedMajorId];

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progressByMajor));
    } catch {
      // Keep the current session usable if local storage is unavailable.
    }
  }, [progressByMajor]);

  const yearCourses = useMemo(() => {
    if (!major) return [];
    return major.years.map((year) => ({
      ...year,
      ids: [...new Set(year.courseIds)].filter((id) => !!COURSE_BY_ID[id]),
    }));
  }, [major]);

  useEffect(() => {
    const available = new Set(yearCourses.flatMap((year) => year.ids));
    if (selectedCourseId && !available.has(selectedCourseId)) setSelectedCourseId(null);
  }, [selectedMajorId, selectedCourseId, yearCourses]);

  const allCourseIds = useMemo(() => yearCourses.flatMap((year) => year.ids), [yearCourses]);
  const completed = new Set(progressByMajor[selectedMajorId] ?? []);
  const completedCount = allCourseIds.filter((id) => completed.has(id)).length;
  const percent = allCourseIds.length ? Math.round((completedCount / allCourseIds.length) * 100) : 0;
  const activeCourseId = hoveredCourseId ?? selectedCourseId;
  const selectedCourse = selectedCourseId ? COURSE_BY_ID[selectedCourseId] : null;
  const selectedYear = selectedCourseId ? yearCourses.find((year) => year.ids.includes(selectedCourseId)) : null;

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
      <div className="mx-auto max-w-[1400px]">
        <header className="panel mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--accent)' }}>Planora · Academic roadmap</p>
            <h2 className="mt-1 text-2xl font-extrabold">My Degree</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Choose a course on the roadmap to view its details and prerequisites.</p>
          </div>
          <button type="button" className="btn" onClick={onClose}>Back to planner</button>
        </header>

        <section className="panel mb-4 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 flex-1">
              <label htmlFor="degree-major" className="mb-2 block text-xs font-bold">Major</label>
              <select id="degree-major" className="select w-full max-w-md" value={selectedMajorId} onChange={(event) => { setSelectedMajorId(event.target.value); setHoveredCourseId(null); setSelectedCourseId(null); }}>
                {MAJORS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              {major && <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>{major.subtitle}</p>}
            </div>
            <div className="w-full md:max-w-xs">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span style={{ color: 'var(--muted)' }}>Your progress</span>
                <strong>{completedCount}/{allCourseIds.length} courses · {percent}%</strong>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }} role="progressbar" aria-label="Degree progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${percent}%`, background: 'var(--accent-fill)' }} />
              </div>
              <p className="mt-2 text-[10px]" style={{ color: 'var(--muted-2)' }}>Saved only on this device; not an official university transcript.</p>
            </div>
          </div>
        </section>

        {!major ? <section className="panel p-5">No curriculum is available for this major yet.</section> : (
          <>
            <section className="panel overflow-hidden p-3 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-extrabold">{major.title} roadmap</h3>
                  <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Follow the path from Year 1 to Year 4. Select any node for course information.</p>
                </div>
                <div className="flex flex-wrap gap-3 text-[10px]" style={{ color: 'var(--muted)' }}>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent-fill)' }} /> Available</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--ok)' }} /> Completed</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: 'var(--accent-fill)' }} /> Selected</span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {yearCourses.map((year, yearIndex) => {
                  const yearDone = year.ids.filter((id) => completed.has(id)).length;
                  return (
                    <section key={year.id} className="relative min-w-0 rounded-2xl border p-3 sm:p-4" style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--paper) 88%, var(--accent-fill) 12%)' }}>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black" style={{ color: 'var(--accent-contrast, white)', background: 'var(--accent-fill)', boxShadow: '0 5px 16px color-mix(in srgb, var(--accent-fill) 24%, transparent)' }}>{yearIndex + 1}</div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-extrabold">{year.label}</h4>
                          <p className="mt-0.5 text-[10px]" style={{ color: 'var(--muted)' }}>{yearDone} of {year.ids.length} completed</p>
                        </div>
                      </div>
                      <div className="relative space-y-2.5 pl-4">
                        <div className="absolute bottom-3 left-[7px] top-3 w-[2px] rounded-full" style={{ background: 'color-mix(in srgb, var(--accent-fill) 38%, var(--line))' }} />
                        {year.ids.map((id, courseIndex) => {
                          const course = COURSE_BY_ID[id];
                          const isDone = completed.has(id);
                          const isSelected = selectedCourseId === id;
                          const isActive = activeCourseId === id;
                          const isDimmed = !!activeCourseId && !isActive;
                          return (
                            <div key={id} className="relative">
                              <span className="absolute -left-4 top-[17px] z-[1] h-3.5 w-3.5 rounded-full border-[3px] transition-all duration-200" style={{ borderColor: isActive ? 'var(--accent-fill)' : isDone ? 'var(--ok)' : 'var(--paper)', background: isDone ? 'var(--ok)' : 'var(--accent-fill)', boxShadow: isActive ? '0 0 0 5px color-mix(in srgb, var(--accent-fill) 18%, transparent), 0 0 18px color-mix(in srgb, var(--accent-fill) 45%, transparent)' : 'none' }} />
                              <button
                                type="button"
                                aria-pressed={isSelected}
                                onMouseEnter={() => setHoveredCourseId(id)}
                                onMouseLeave={() => setHoveredCourseId(null)}
                                onFocus={() => setHoveredCourseId(id)}
                                onBlur={() => setHoveredCourseId(null)}
                                onClick={() => { setSelectedCourseId(id); setDetailTab('course'); }}
                                className="group relative w-full rounded-xl border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2"
                                style={{
                                  borderColor: isSelected ? 'var(--accent-fill)' : isDone ? 'color-mix(in srgb, var(--ok) 55%, var(--line))' : 'var(--line)',
                                  background: isSelected ? 'color-mix(in srgb, var(--accent-fill) 13%, var(--paper))' : isDone ? 'color-mix(in srgb, var(--ok) 9%, var(--paper))' : 'var(--paper)',
                                  opacity: isDimmed ? 0.46 : 1,
                                  transform: isActive ? 'translateX(3px)' : 'translateX(0)',
                                  boxShadow: isActive ? '0 5px 18px color-mix(in srgb, var(--accent-fill) 17%, transparent)' : 'none',
                                  outlineColor: 'var(--accent-fill)',
                                }}
                                title={`View ${course.code} details`}
                              >
                                <span className="flex items-start justify-between gap-2">
                                  <span className="min-w-0">
                                    <span className="block text-[11px] font-extrabold tracking-wide" style={{ color: isActive ? 'var(--accent)' : 'var(--text)' }}>{course.code}</span>
                                    <span className="mt-1 block text-xs font-semibold leading-snug" style={{ color: 'var(--text)' }}>{course.name}</span>
                                  </span>
                                  <span className="mt-0.5 shrink-0 rounded-full px-2 py-1 text-[9px] font-bold" style={{ color: isDone ? 'var(--ok)' : 'var(--muted)', background: isDone ? 'color-mix(in srgb, var(--ok) 12%, transparent)' : 'var(--surface-2)' }}>{isDone ? 'Done' : `Node ${courseIndex + 1}`}</span>
                                </span>
                                {course.credits != null && <span className="mt-2 inline-block text-[10px]" style={{ color: 'var(--muted)' }}>{course.credits} credits</span>}
                              </button>
                            </div>
                          );
                        })}
                        {year.ids.length === 0 && <p className="rounded-xl border border-dashed p-3 text-xs" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>Course plan not published yet.</p>}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>


            {selectedCourse && (
              <div className="fixed inset-0 z-[145] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Course details for ${selectedCourse.code}`} onClick={(event) => { if (event.target === event.currentTarget) setSelectedCourseId(null); }}>
                <section className="panel max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-b-none p-4 sm:rounded-2xl sm:p-5">
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--accent)' }}>Planora · Course Details</p>
                      <h3 className="mt-2 text-lg font-extrabold sm:text-xl">{selectedCourse.code}: {selectedCourse.name}</h3>
                      <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{selectedYear?.label ?? major.title}</p>
                    </div>
                    <button type="button" className="btn shrink-0" onClick={() => setSelectedCourseId(null)} aria-label="Close course details">✕</button>
                  </header>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Term</p>
                      <p className="mt-1 text-sm font-semibold">Fall 2026 · Main Session</p>
                    </div>
                    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Credits</p>
                      <p className="mt-1 text-sm font-semibold">{selectedCourse.credits != null ? selectedCourse.credits : 'Not confirmed in this roadmap data'}</p>
                    </div>
                    <div className="rounded-xl border p-3 sm:col-span-2" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Course status</p>
                      <label className="mt-2 flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" className="h-4 w-4 accent-[var(--accent-fill)]" checked={completed.has(selectedCourse.id)} onChange={(event) => toggleCourse(selectedCourse.id, event.target.checked)} />
                        {completed.has(selectedCourse.id) ? 'Completed' : 'Mark as completed'}
                      </label>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2 border-b" style={{ borderColor: 'var(--line)' }} role="tablist" aria-label="Course information">
                    <button type="button" role="tab" aria-selected={detailTab === 'course'} onClick={() => setDetailTab('course')} className="border-b-2 px-3 py-2 text-xs font-bold" style={{ borderColor: detailTab === 'course' ? 'var(--accent-fill)' : 'transparent', color: detailTab === 'course' ? 'var(--accent)' : 'var(--muted)' }}>Course Details</button>
                    <button type="button" role="tab" aria-selected={detailTab === 'prerequisites'} onClick={() => setDetailTab('prerequisites')} className="border-b-2 px-3 py-2 text-xs font-bold" style={{ borderColor: detailTab === 'prerequisites' ? 'var(--accent-fill)' : 'transparent', color: detailTab === 'prerequisites' ? 'var(--accent)' : 'var(--muted)' }}>Prerequisites</button>
                  </div>
                  {detailTab === 'course' ? (
                    <div className="mt-4 rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Course name</p>
                      <p className="mt-1 text-sm font-semibold">{selectedCourse.name}</p>
                      <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>Course details shown here are limited to information verified in the roadmap dataset. Section, instructor, schedule, and room information are only shown when a verified timetable match exists.</p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border p-4" style={{ borderColor: 'color-mix(in srgb, var(--accent-fill) 28%, var(--line))', background: 'color-mix(in srgb, var(--accent-fill) 6%, var(--paper))' }}>
                      <p className="text-sm font-extrabold">Prerequisites</p>
                      <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>Prerequisites are not confirmed for this course in the verified data currently available. No requirement is inferred from a similar course name or code.</p>
                    </div>
                  )}
                  <p className="mt-4 text-[10px] leading-relaxed" style={{ color: 'var(--muted-2)' }}>Student planner · unofficial · course prerequisites and enrollment details are shown only when verified from an official source.</p>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
