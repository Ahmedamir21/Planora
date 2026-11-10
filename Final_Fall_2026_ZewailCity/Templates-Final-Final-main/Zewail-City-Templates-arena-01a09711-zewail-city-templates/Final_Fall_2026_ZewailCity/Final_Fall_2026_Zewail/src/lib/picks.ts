import type { Course, Instructor, Meeting, MeetingType } from '../types';
import { overlaps } from './time';

/** One manual choice per component kind, keyed by meeting uid. */
export interface Pick {
  Lecture: string | null;
  Lab: string | null;
  Tutorial: string | null;
}

export type PickState = Record<string, Pick>;

export const emptyPick = (): Pick => ({ Lecture: null, Lab: null, Tutorial: null });

/** Stable identity for a meeting option (a meeting is unique by all of its attributes). */
export const uid = (m: Meeting): string => `${m.type}|${m.sec}|${m.day}|${m.start}|${m.end}|${m.room}`;

export interface Option {
  key: string;
  meeting: Meeting;
  instructorIdx: number;
  instructor: Instructor;
}

/**
 * Every published option for this kind, across ALL instructor groups. The lecture/lab
 * choice is per-component — students may mix instructors — so the list is the union of
 * every group's sections. If two groups publish the identical section (same uid = same
 * class), it appears once, owned by the first group that lists it.
 */
export function optionsFor(course: Course, kind: MeetingType): Option[] {
  const out: Option[] = [];
  const seen = new Set<string>();
  course.instructors.forEach((instructor, instructorIdx) => {
    const pool = kind === 'Lecture' ? instructor.lectures : kind === 'Lab' ? instructor.labs : instructor.tutorials;
    pool.forEach((meeting) => {
      const key = uid(meeting);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ key, meeting, instructorIdx, instructor });
    });
  });
  return out;
}

/** Which component kinds this course publishes at all (across any instructor). */
export function publishedKinds(course: Course): MeetingType[] {
  const kinds: MeetingType[] = [];
  (['Lecture', 'Lab', 'Tutorial'] as MeetingType[]).forEach((kind) => {
    if (optionsFor(course, kind).length > 0) kinds.push(kind);
  });
  return kinds;
}

/** Resolve a picked uid back to its meeting, searching the whole course. */
export function findPicked(course: Course, key: string | null | undefined): Option | null {
  if (!key) return null;
  for (const kind of ['Lecture', 'Lab', 'Tutorial'] as MeetingType[]) {
    const hit = optionsFor(course, kind).find((o) => o.key === key);
    if (hit) return hit;
  }
  return null;
}

/** Resolve a concrete meeting back to the exact published option/instructor that owns it. */
export function meetingOption(course: Course, meeting: Meeting): Option | null {
  return optionsFor(course, meeting.type).find((o) => o.key === uid(meeting)) ?? null;
}

export interface DraftMeeting {
  courseId: string;
  course: Course;
  option: Option;
  meeting: Meeting;
}

export function draftMeetings(courses: Course[], picks: PickState): DraftMeeting[] {
  const out: DraftMeeting[] = [];
  courses.forEach((course) => {
    const pick = picks[course.id];
    if (!pick) return;
    (['Lecture', 'Lab', 'Tutorial'] as MeetingType[]).forEach((kind) => {
      const option = findPicked(course, pick[kind]);
      if (option) out.push({ courseId: course.id, course, option, meeting: option.meeting });
    });
  });
  return out;
}

export interface OverlapWarning {
  a: DraftMeeting;
  b: DraftMeeting;
  minutes: number;
}

/** Real interval overlaps between manually chosen meetings (same rule as the engine). */
export function draftOverlaps(meetings: DraftMeeting[]): OverlapWarning[] {
  const out: OverlapWarning[] = [];
  for (let i = 0; i < meetings.length; i++) {
    for (let j = i + 1; j < meetings.length; j++) {
      const a = meetings[i].meeting;
      const b = meetings[j].meeting;
      if (overlaps(a, b)) {
        out.push({
          a: meetings[i],
          b: meetings[j],
          minutes: Math.min(a.end, b.end) - Math.max(a.start, b.start),
        });
      }
    }
  }
  return out;
}
