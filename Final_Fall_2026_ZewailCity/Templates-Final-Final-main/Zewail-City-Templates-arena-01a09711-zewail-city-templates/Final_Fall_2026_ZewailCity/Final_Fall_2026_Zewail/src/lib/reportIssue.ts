import type { Course } from '../types';
import { findPicked, type Pick } from './picks';
import { DAY_LABEL, formatRange } from './time';

export function courseIssueText(course: Course, pick?: Pick): string {
  const lines = [`Data issue report · ${course.code} — ${course.name}`];

  if (pick) {
    (['Lecture', 'Lab', 'Tutorial'] as const).forEach((kind) => {
      const option = findPicked(course, pick[kind]);
      if (!option) return;
      const meeting = option.meeting;
      const instructor = option.instructor.unassigned ? 'Instructor not assigned' : option.instructor.name;
      lines.push(
        `${kind} Sec ${meeting.sec} · ${DAY_LABEL[meeting.day]} ${formatRange(meeting.start, meeting.end)} · ${meeting.room || 'Room not published'} · ${instructor}`,
      );
    });
  }

  lines.push('', 'Issue found: ');
  return lines.join('\n');
}

export function generalIssueText(): string {
  return [
    'Planora · Data issue report',
    'Course code: ',
    'Component (Lecture/Lab/Tutorial): ',
    'Section: ',
    'Issue found: ',
  ].join('\n');
}

export function issueDraftUrl(report: {
  types: string[];
  courseCode: string;
  component: string;
  section: string;
  details: string;
  publishedData: string;
}): string {
  const title = `[Data report] ${report.courseCode || 'General'} — ${report.types.join(', ')}`;
  const body = [
    'Planora student report · Fall 2026',
    `Problem with: ${report.types.join(', ')}`,
    `Course code: ${report.courseCode || 'Not specified'}`,
    `Component: ${report.component || 'Not specified'}`,
    `Section: ${report.section || 'Not specified'}`,
    '',
    'What needs correcting:',
    report.details,
    ...(report.publishedData ? ['', 'Current planner data for this course:', report.publishedData] : []),
  ].join('\n');
  return `https://github.com/Ahmedamir21/Planora/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}


export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to a DOM copy fallback.
    }
  }

  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
