import type { Course, Instructor, Meeting, MeetingType, Pairing } from '../../types';
import { uid } from '../picks';
import { overlaps, sortMeetings } from '../time';

/**
 * Cross-instructor pairing pool for one course: every published lecture, lab and
 * tutorial of the course, whatever instructor teaches it, plus the instructor index
 * that owns each option (for display and filters). Same-uid duplicates published under
 * two groups collapse to one entry (same section, same time = the same class).
 */
export function buildCourseOptions(course: Course) {
  const pools: Record<MeetingType, { meeting: Meeting; instrIdx: number }[]> = { Lecture: [], Lab: [], Tutorial: [] };
  const seen: Record<MeetingType, Set<string>> = { Lecture: new Set(), Lab: new Set(), Tutorial: new Set() };
  course.instructors.forEach((instructor, instrIdx) => {
    (['Lecture', 'Lab', 'Tutorial'] as MeetingType[]).forEach((kind) => {
      const src = kind === 'Lecture' ? instructor.lectures : kind === 'Lab' ? instructor.labs : instructor.tutorials;
      src.forEach((meeting) => {
        const key = uid(meeting);
        if (seen[kind].has(key)) return;
        seen[kind].add(key);
        pools[kind].push({ meeting, instrIdx });
      });
    });
  });
  return pools;
}

/**
 * Build every internally conflict-free combination of the components the course
 * publishes — ACROSS instructor groups. A lecture from one teacher may be paired with
 * a lab or tutorial from another; the ONLY exclusion rule is a real time overlap
 * between the component meetings (day/time), which mirrors exactly how the cross-course
 * search prunes. Components that do not exist are never invented: if the course has
 * labs, every combination contains one lecture-sized pick per published type, and a
 * lecture-only course yields lecture-only pairings. Section numbers are NOT assumed to
 * match across groups.
 */
export function buildCoursePairings(course: Course): Pairing[] {
  const pools = buildCourseOptions(course);
  const groups: { kind: MeetingType; items: { meeting: Meeting; instrIdx: number }[] }[] = (
    ['Lecture', 'Lab', 'Tutorial'] as MeetingType[]
  )
    .map((kind) => ({ kind, items: pools[kind] }))
    .filter((g) => g.items.length > 0);
  if (groups.length === 0) return [];

  let acc: { meetings: Meeting[]; owners: Partial<Record<MeetingType, number>> }[] = [{ meetings: [], owners: {} }];
  for (const group of groups) {
    const next: { meetings: Meeting[]; owners: Partial<Record<MeetingType, number>> }[] = [];
    for (const base of acc) {
      for (const candidate of group.items) {
        // Internal (same course) overlap → rejected, no matter who teaches either side.
        if (base.meetings.some((b) => overlaps(b, candidate.meeting))) continue;
        next.push({
          meetings: [...base.meetings, candidate.meeting],
          owners: { ...base.owners, [group.kind]: candidate.instrIdx },
        });
      }
    }
    if (next.length === 0) return [];
    acc = next;
  }

  return acc.map(({ meetings, owners }) => {
    const sorted = sortMeetings(meetings);
    return {
      meetings: sorted,
      lecture: sorted.find((x) => x.type === 'Lecture'),
      labs: sorted.filter((x) => x.type === 'Lab'),
      tutorials: sorted.filter((x) => x.type === 'Tutorial'),
      instructors: owners,
    };
  });
}

/**
 * Build every internally conflict-free combination of the components that
 * actually exist for this instructor (lecture × lab × tutorial).
 *
 * Components that do not exist are never invented: an instructor with a lecture
 * and no labs yields lecture-only pairings, and an instructor with labs and no
 * lecture yields lab-only pairings. Section numbers are NOT assumed to match.
 */
export function buildPairings(instr: Instructor): Pairing[] {
  const groups: Meeting[][] = [];
  if (instr.lectures.length) groups.push(instr.lectures);
  if (instr.labs.length) groups.push(instr.labs);
  if (instr.tutorials.length) groups.push(instr.tutorials);
  if (groups.length === 0) return [];

  let acc: Meeting[][] = [[]];
  for (const group of groups) {
    const next: Meeting[][] = [];
    for (const base of acc) {
      for (const candidate of group) {
        // Internal (same course) overlap → rejected. Non-credit meetings count.
        if (base.some((b) => overlaps(b, candidate))) continue;
        next.push([...base, candidate]);
      }
    }
    if (next.length === 0) return [];
    acc = next;
  }

  return acc.map((meetings) => {
    const sorted = sortMeetings(meetings);
    return {
      meetings: sorted,
      lecture: sorted.find((x) => x.type === 'Lecture'),
      labs: sorted.filter((x) => x.type === 'Lab'),
      tutorials: sorted.filter((x) => x.type === 'Tutorial'),
    };
  });
}

/* ------------------------------------------------------------------ */
/* 2. Combination generation (backtracking + pruning)                  */
/* ------------------------------------------------------------------ */
