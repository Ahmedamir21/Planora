import type { Course } from '../types';

export const SCH_ELECTIVE_COURSES: Course[] = [
  {
    id: 'sch163',
    code: 'SCH 163',
    name: 'Sustain, Social & Ethical Issues in Comp',
    c: 7,
    credits: 2,
    instructors: [
      {
        name: 'Sherif Hamdy ElGohary',
        lectures: [
          {
            type: 'Lecture',
            sec: '01',
            day: 'Thu',
            start: 10 * 60,
            end: 12 * 60,
            room: 'Online',
          },
        ],
        labs: [],
        tutorials: [],
      },
    ],
  },

  {
    id: 'sch105',
    code: 'SCH 105',
    name: 'Critical Thinking',
    c: 7,
    credits: 2,
    instructors: [
      {
        name: 'Ahmed Hamdy',
        lectures: [
          {
            type: 'Lecture',
            sec: '01',
            day: 'Wed',
            start: 8 * 60,
            end: 10 * 60,
            room: 'F26-B4',
          },
          {
            type: 'Lecture',
            sec: '02',
            day: 'Wed',
            start: 10 * 60,
            end: 12 * 60,
            room: 'F26-B4',
          },
        ],
        labs: [],
        tutorials: [],
      },
    ],
  },

  {
    id: 'sch110',
    code: 'SCH 110',
    name: 'Creativity and Innovation',
    c: 7,
    credits: 2,
    instructors: [
      {
        name: 'Ahmed Hamdy',
        lectures: [
          {
            type: 'Lecture',
            sec: '01',
            day: 'Tue',
            start: 8 * 60,
            end: 10 * 60,
            room: 'F26-B4',
          },
        ],
        labs: [],
        tutorials: [],
      },
    ],
  },

  {
    id: 'sch201',
    code: 'SCH 201',
    name: 'World Literature',
    c: 7,
    credits: 2,
    instructors: [
      {
        name: 'Loubna Abdeltawab',
        lectures: [
          {
            type: 'Lecture',
            sec: '01',
            day: 'Sun',
            start: 8 * 60,
            end: 10 * 60,
            room: 'F29-B4',
          },
        ],
        labs: [],
        tutorials: [],
      },
    ],
  },

  {
    id: 'sch244',
    code: 'SCH 244',
    name: 'Leadership & Professionalism',
    c: 7,
    credits: 2,
    instructors: [
      {
        name: 'Hassan Darwish',
        lectures: [
          {
            type: 'Lecture',
            sec: '01',
            day: 'Wed',
            start: 14 * 60,
            end: 16 * 60,
            room: 'F29-B4',
          },
          {
            type: 'Lecture',
            sec: '02',
            day: 'Sun',
            start: 20 * 60,
            end: 22 * 60,
            room: 'Online',
          },
        ],
        labs: [],
        tutorials: [],
      },
    ],
  },

  {
    id: 'sch258',
    code: 'SCH 258',
    name: 'Arabic Literature',
    c: 7,
    credits: 2,
    instructors: [
      {
        name: 'Samy Ahmed',
        lectures: [
          {
            type: 'Lecture',
            sec: '01',
            day: 'Tue',
            start: 18 * 60,
            end: 20 * 60,
            room: 'Online',
          },
        ],
        labs: [],
        tutorials: [],
      },
    ],
  },

  {
    id: 'sch260',
    code: 'SCH 260',
    name: 'Philosophical Thinking',
    c: 7,
    credits: 2,
    instructors: [
      {
        name: 'Ahmed Hamdy',
        lectures: [
          {
            type: 'Lecture',
            sec: '01',
            day: 'Tue',
            start: 10 * 60,
            end: 12 * 60,
            room: 'F30-B4',
          },
          {
            type: 'Lecture',
            sec: '02',
            day: 'Tue',
            start: 12 * 60,
            end: 14 * 60,
            room: 'F012-E',
          },
        ],
        labs: [],
        tutorials: [],
      },
    ],
  },

  {
  id: 'sch261',
  code: 'SCH 261',
  name: 'Engineering Project Management',
  c: 7,
  credits: 2,
  instructors: [
    {
      name: 'Hassan Darwish',
      lectures: [
        {
          type: 'Lecture',
          sec: '01',
          day: 'Wed',
          start: 10 * 60,
          end: 12 * 60,
          room: 'G011-B',
        },
        {
          type: 'Lecture',
          sec: '02',
          day: 'Wed',
          start: 19 * 60,
          end: 21 * 60,
          room: 'Online',
        },
        {
          type: 'Lecture',
          sec: '03',
          day: 'Wed',
          start: 17 * 60,
          end: 19 * 60,
          room: 'Online',
        },
      ],
      labs: [],
      tutorials: [],
    },
  ],
},

  {
    id: 'sch262',
    code: 'SCH 262',
    name: 'Engineering Project Economics',
    c: 7,
    credits: 2,
    instructors: [
      {
        name: 'Sherif Hamdy ElGohary',
        lectures: [
          {
            type: 'Lecture',
            sec: '01',
            day: 'Tue',
            start: 10 * 60,
            end: 12 * 60,
            room: 'G009-B',
          },
        ],
        labs: [],
        tutorials: [],
      },
    ],
  },

 {
  id: 'sch263',
  code: 'SCH 263',
  name: 'Engineering Ethics and Safety',
  c: 7,
  credits: 2,
  instructors: [
    {
      name: 'Ahmed Fahmy',
      lectures: [
        {
          type: 'Lecture',
          sec: '01',
          day: 'Mon',
          start: 8 * 60,
          end: 10 * 60,
          room: 'F010-D',
        },
      ],
      labs: [],
      tutorials: [],
    },
  ],
},

  {
  id: 'sch264',
  code: 'SCH 264',
  name: 'Intro to Entrepreneurship & Small Mangm',
  c: 7,
  credits: 2,
  instructors: [
    {
      name: 'Sherif Hamdy ElGohary',
      lectures: [
        {
          type: 'Lecture',
          sec: '01',
          day: 'Tue',
          start: 12 * 60,
          end: 14 * 60,
          room: 'F012-D',
        },
      ],
      labs: [],
      tutorials: [],
    },
  ],
},

  {
    id: 'sch273',
    code: 'SCH 273',
    name: 'Cognitive Psychology',
    c: 7,
    credits: 2,
    instructors: [
      {
        name: 'Nashwa Abdel Tawab Soliman',
        lectures: [
          {
            type: 'Lecture',
            sec: '01',
            day: 'Tue',
            start: 10 * 60,
            end: 12 * 60,
            room: 'F32-B4',
          },
        ],
        labs: [],
        tutorials: [],
      },
    ],
  },

   {
    id: 'sch277',
    code: 'SCH 277',
    name: 'Positive Psychology',
    c: 7,
    credits: 2,
    instructors: [
      {
        name: 'Nashwa Abdel Tawab Soliman',
        lectures: [
          {
            type: 'Lecture',
            sec: '01',
            day: 'Tue',
            start: 12 * 60,
            end: 14 * 60,
            room: 'F004-D',
          },
        ],
        labs: [],
        tutorials: [],
      },
    ],
  },
];

export const SCH_ELECTIVE_COURSE_IDS = SCH_ELECTIVE_COURSES.map(
  (course) => course.id,
);
