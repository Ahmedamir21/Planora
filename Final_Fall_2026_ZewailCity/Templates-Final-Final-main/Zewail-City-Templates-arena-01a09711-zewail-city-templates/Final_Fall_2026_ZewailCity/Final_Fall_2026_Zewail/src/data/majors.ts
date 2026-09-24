
import type { Major, YearPlan } from '../types';
import { SCH_ELECTIVE_COURSE_IDS } from './schElectives';

export const YEAR_IDS = ['y1', 'y2', 'y3', 'y4'] as const;

/**
 * Shared courses available to every major and every year.
 * SCH electives are not duplicated inside individual year plans.
 */
export const COMMON_COURSE_IDS: string[] = [
  ...SCH_ELECTIVE_COURSE_IDS,
];

export const MAJORS: Major[] = [
  {
    id: 'it',
    title: 'Information Technology',
    subtitle: 'Networks, Security & Governance',
    blurb: 'Enterprise systems, infrastructure and governance track.',
    years: [
      {
        id: 'y1',
        label: 'Year 1 (Freshman)',
        courseIds: [
          'csai100',
          'csai101',
          'csai102',
          'csai252',
          'csai151',
          'math103',
          'math104',
          'it101',
          'it102',
          'it103',
        ],
      },
      {
        id: 'y2',
        label: 'Year 2 (Sophomore)',
        courseIds: ['csai201', 'csai202', 'math105', 'csai205', 'it205'],
      },
      {
        id: 'y3',
        label: 'Year 3 (Junior)',
        courseIds: ['csai203', 'csai301', 'it308', 'itns301', 'math205'],
      },
      {
        id: 'y4',
        label: 'Year 4 (Senior)',
        courseIds: ['itns403', 'itns404', 'itns406', 'it402', 'it411', 'csai498'],
      },
    ],
  },

  {
    id: 'dsai',
    title: 'Data Science & AI',
    subtitle: 'Data Science and Artificial Intelligence',
    blurb: 'Data integration, analytics and intelligent systems track.',
    years: [
      {
        id: 'y1',
        label: 'Year 1 (Freshman)',
        courseIds: [
          'csai100',
          'csai101',
          'csai102',
          'csai252',
          'csai151',
          'math103',
          'math104',
          'dsai104',
          'dsai103',
        ],
      },
      {
        id: 'y2',
        label: 'Year 2 (Sophomore)',
        courseIds: ['csai201', 'csai202', 'math105', 'csai205', 'dsai203'],
      },
      {
        id: 'y3',
        label: 'Year 3 (Junior)',
        courseIds: ['csai203', 'csai301', 'dsai307', 'dsai308', 'math303'],
      },
      {
        id: 'y4',
        label: 'Year 4 (Senior)',
        courseIds: ['dsai403', 'csai302', 'dsai402', 'dsai456', 'csai498'],
      },
    ],
  },

  {
    id: 'software',
    title: 'Software',
    subtitle: 'Software Engineering',
    blurb:
      'Engineering process and physics track — swaps CSAI 205 / the elective for CSAI 203 + PHYS 104.',
    years: [
      {
        id: 'y1',
        label: 'Year 1 (Freshman)',
        courseIds: [
          'csai100',
          'csai101',
          'csai102',
          'csai252',
          'csai151',
          'math103',
          'math104',
          'sw151',
          'phys103',
        ],
      },
      {
        id: 'y2',
        label: 'Year 2 (Sophomore)',
        courseIds: ['csai201', 'csai202', 'csai203', 'phys104', 'math105'],
      },
      {
        id: 'y3',
        label: 'Year 3 (Junior)',
        courseIds: ['csai301', 'sw301', 'sw252', 'sw302', 'swapd301', 'swgcg301', 'swhci301'],
      },
      {
        id: 'y4',
        label: 'Year 4 (Senior)',
        courseIds: [
          'sw401',
          'swapd401',
          'swapd402',
          'sw402',
          'swgcg401',
          'swgcg402',
          'swhci401',
          'swhci402',
          'csai498',
        ],
      },
    ],
  },
];

export const MAJOR_BY_ID: Record<string, Major> = Object.fromEntries(
  MAJORS.map((mj) => [mj.id, mj]),
);

export function yearPlanOf(
  major: Major,
  yearId: string | null | undefined,
): YearPlan {
  return major.years.find((y) => y.id === yearId) ?? major.years[0];
}

export function allYearCourseIds(major: Major): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  major.years.forEach((y) =>
    y.courseIds.forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      out.push(id);
    }),
  );

  return out;
}

export function allAvailableCourseIds(major: Major): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  [...allYearCourseIds(major), ...COMMON_COURSE_IDS].forEach((id) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });

  return out;
}

export function yearBadgeOf(
  major: Major,
  courseId: string,
): string | null {
  const year = major.years.find((y) => y.courseIds.includes(courseId));
  return year ? year.label.replace(/\s*\(.*\)$/, '') : null;
}
