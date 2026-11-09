import { dataCompleteness } from '../src/lib/dataCompleteness';
import { COURSE_BY_ID } from '../src/data/courses';
import type { Course } from '../src/types';

const baseline = structuredClone(COURSE_BY_ID.csai201) as Course;
const item = baseline.instructors[0].lectures[0];
item.room = '';
baseline.instructors[0].unassigned = true;
const gaps = dataCompleteness([baseline]);
if (!gaps.some(gap => gap.issue === 'Room missing' && gap.section === item.sec) ||
    !gaps.some(gap => gap.issue === 'Instructor unassigned' && gap.section === item.sec)) throw new Error('Published missing room or teacher was not reported');
if (COURSE_BY_ID.csai201.instructors[0].lectures[0].room === '') throw new Error('Audit mutated the published catalog');
console.log('Published data completeness: missing room and unassigned instructor OK');
