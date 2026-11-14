import { FILES } from './admin-dataset';

export function validData(file: typeof FILES[number], content: string) {
  if (content.length > 250_000) return 'Dataset is too large.';
  let value: any;
  try { value = JSON.parse(content); } catch { return 'Invalid JSON.'; }
  if (file === 'semester.json') {
    if (!value || typeof value.key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.calendarStartDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(value.calendarEndDate || '') || value.calendarStartDate > value.calendarEndDate) return 'Invalid semester config or dates.';
    return null;
  }
  if (!Array.isArray(value)) return 'Dataset must be an array.';
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item.id !== 'string' || !item.id || seen.has(item.id)) return 'Missing or duplicate ID.';
    seen.add(item.id);
    if (file === 'majors.json') {
      if (!Array.isArray(item.years) || item.years.some((year: any) => !Array.isArray(year.courseIds))) return 'Invalid major/year mapping.';
    } else {
      if (!item.code || !item.name || !Array.isArray(item.instructors)) return 'Course is missing required fields.';
      for (const teacher of item.instructors) {
        if (typeof teacher.name !== 'string' || !teacher.name.trim()) return 'Instructor name is missing.';
        for (const group of ['lectures', 'labs', 'tutorials']) {
          if (!Array.isArray(teacher[group])) return 'Missing meeting group.';
          for (const meeting of teacher[group]) if (!['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].includes(meeting.day) || !Number.isInteger(meeting.start) || !Number.isInteger(meeting.end) || meeting.start < 0 || meeting.end > 1440 || meeting.start >= meeting.end || typeof meeting.sec !== 'string' || !meeting.sec) return 'Invalid meeting day, time or section.';
        }
      }
    }
  }
  return null;
}
