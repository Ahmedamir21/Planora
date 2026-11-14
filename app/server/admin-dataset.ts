import { redis, draftKey, liveKey } from '../api/admin-store';
import { validateDataset } from '../dataset-validation.cjs';
import publishedSemester from '../../planner/src/semester/semester.json';
import publishedCourses from '../../planner/src/semester/courses.json';
import publishedMajors from '../../planner/src/semester/majors.json';
import publishedSch from '../../planner/src/semester/sch.json';

export { publishedSemester, publishedCourses, publishedMajors, publishedSch };

export const FILES = ['semester.json', 'courses.json', 'majors.json', 'sch.json'] as const;
export const allowedFile = (name: unknown): name is typeof FILES[number] => typeof name === 'string' && FILES.some(file => file === name);
export const published = { 'semester.json': publishedSemester, 'courses.json': publishedCourses, 'majors.json': publishedMajors, 'sch.json': publishedSch };
export async function combinedDataset(file?: typeof FILES[number], proposed?: string) {
  const values: Record<string, any> = {};
  for (const name of FILES) {
    const content = file === name && proposed !== undefined ? proposed : await redis(['GET', draftKey(name)]);
    values[name.replace('.json', '')] = content == null ? published[name] : JSON.parse(content);
  }
  return validateDataset(values);
}

export async function effectiveCatalog() {
  const [coursesOverride, schOverride] = await Promise.all([
    redis(['GET', liveKey('courses.json')]), redis(['GET', liveKey('sch.json')]),
  ]);
  return {
    coursesOverride: coursesOverride || '',
    schOverride: schOverride || '',
    courses: coursesOverride ? JSON.parse(coursesOverride) : publishedCourses,
    sch: schOverride ? JSON.parse(schOverride) : publishedSch,
  };
}
