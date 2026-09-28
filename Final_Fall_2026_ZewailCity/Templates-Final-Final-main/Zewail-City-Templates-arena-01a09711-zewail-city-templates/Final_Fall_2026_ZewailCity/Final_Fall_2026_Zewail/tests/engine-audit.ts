import courses from '../src/semester/courses.json';
import sch from '../src/semester/sch.json';
import { runEngineAudit } from '../src/lib/engineAudit';
import type { Course } from '../src/types';

const checks = runEngineAudit([...courses, ...sch] as Course[]);
if (checks.length !== 16 || checks.some((check) => !check.passed)) {
  for (const check of checks.filter((item) => !item.passed)) console.error(`FAIL: ${check.title}: ${check.detail}`);
  throw new Error(`Scheduling engine audit: ${checks.filter((check) => check.passed).length}/${checks.length} passed`);
}
console.log(`Scheduling engine audit: ${checks.length}/${checks.length} passed`);
