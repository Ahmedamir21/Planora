export function syncCounts(courses: any[], sch: any[]) {
  const all = [...courses, ...sch];
  const meetings = all.flatMap(course => Array.isArray(course?.instructors) ? course.instructors : [])
    .flatMap((teacher: any) => [...(teacher.lectures || []), ...(teacher.labs || []), ...(teacher.tutorials || [])]);
  return { courses: all.length, sections: meetings.length };
}
export function syncChangeSummary(beforeCourses: any[], beforeSch: any[], nextCourses: any[], nextSch: any[]) {
  const before = [...beforeCourses, ...beforeSch];
  const next = [...nextCourses, ...nextSch];
  const oldMap = new Map(before.map((course: any) => [course.id, { raw: JSON.stringify(course), code: course.code || course.id }]));
  const newMap = new Map(next.map((course: any) => [course.id, { raw: JSON.stringify(course), code: course.code || course.id }]));
  const ids = new Set([...oldMap.keys(), ...newMap.keys()]);
  const changed: string[] = [], added: string[] = [], removed: string[] = [];
  ids.forEach(id => {
    const oldCourse = oldMap.get(id); const newCourse = newMap.get(id);
    if (!oldCourse && newCourse) added.push(String(newCourse.code));
    else if (oldCourse && !newCourse) removed.push(String(oldCourse.code));
    else if (oldCourse?.raw !== newCourse?.raw) changed.push(String(newCourse?.code || oldCourse?.code || id));
  });
  const beforeCounts = syncCounts(beforeCourses, beforeSch);
  const nextCounts = syncCounts(nextCourses, nextSch);
  return {
    changedCourses: changed.length, addedCourses: added.length, removedCourses: removed.length,
    changed: changed.slice(0, 100), added: added.slice(0, 100), removed: removed.slice(0, 100),
    previousSections: beforeCounts.sections, sections: nextCounts.sections, sectionDelta: nextCounts.sections - beforeCounts.sections,
  };
}
export function syncStatus(value: Record<string, unknown>) {
  return JSON.stringify({ updatedAt: new Date().toISOString(), ...value });
}
