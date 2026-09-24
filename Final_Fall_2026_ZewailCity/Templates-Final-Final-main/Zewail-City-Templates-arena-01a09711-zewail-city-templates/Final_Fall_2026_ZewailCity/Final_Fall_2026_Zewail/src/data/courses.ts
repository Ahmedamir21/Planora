import type { Course, Day, Instructor, Meeting, MeetingType } from '../types';
import { SCH_ELECTIVE_COURSES } from './schElectives';

/**
 * Time encoding
 * -------------
 * The original app used fixed blocks A–E. They are converted here to REAL minute
 * intervals without changing a single meeting:
 *   A = 8:00–9:59 AM  → 480–600
 *   B = 10:00–11:59 AM → 600–720
 *   C = 12:00–1:59 PM  → 720–840
 *   D = 2:00–3:59 PM   → 840–960
 *   E = 4:00–5:59 PM   → 960–1080
 * So existing meetings keep exactly the same occupied time as before, while new
 * one-hour meetings (e.g. PHYS 104 tutorials) can now be represented accurately.
 */
const B = { A: [8, 10], B: [10, 12], C: [12, 14], D: [14, 16], E: [16, 18] } as const;
type Block = keyof typeof B;

function m(type: MeetingType, sec: string, day: Day, startHour: number, endHour: number, room: string): Meeting {
  return { type, sec, day, start: startHour * 60, end: endHour * 60, room };
}

function mb(type: MeetingType, sec: string, day: Day, block: Block, room: string): Meeting {
  const [s, e] = B[block];
  return m(type, sec, day, s, e, room);
}

const lec = (sec: string, day: Day, block: Block, room: string) => mb('Lecture', sec, day, block, room);
const lab = (sec: string, day: Day, block: Block, room: string) => mb('Lab', sec, day, block, room);
const tut = (sec: string, day: Day, block: Block, room: string) => mb('Tutorial', sec, day, block, room);

/* ------------------------------------------------------------------ */
/* CSAI 203 / PHYS 104 helpers (real hours, including 1-hour meetings) */
/* ------------------------------------------------------------------ */
const lecH = (sec: string, day: Day, sh: number, eh: number, room: string) => m('Lecture', sec, day, sh, eh, room);
const labH = (sec: string, day: Day, sh: number, eh: number, room: string) => m('Lab', sec, day, sh, eh, room);
const tutH = (sec: string, day: Day, sh: number, eh: number, room: string) => m('Tutorial', sec, day, sh, eh, room);

/* =============================== DATA =============================== */

const csai201: Course = {
  id: 'csai201',
  code: 'CSAI 201',
  name: 'Data Structures',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Mayada Mansour Ali',
      lectures: [
        lec('01', 'Tue', 'C', 'G038B'),
      ],
      labs: [
        lab('01', 'Wed', 'D', 'G012-E'),
        lab('02', 'Wed', 'B', 'G012-E'),
        lab('03', 'Wed', 'D', 'G013-E'),
        lab('04', 'Wed', 'B', 'G013-E'),
      ],
      tutorials: [],
    },

    {
      name: 'Elmahdy Maree Maree',
      lectures: [
        lec('02', 'Tue', 'D', 'G038B'),
        lec('04', 'Tue', 'C', 'G033B'),
      ],
      labs: [],
      tutorials: [],
    },

    {
      name: 'Mohamed Elhalaby Elhalaby',
      lectures: [
        lec('03', 'Wed', 'A', 'G038B'),
      ],
      labs: [
        lab('05', 'Wed', 'E', 'G013-E'),
        lab('06', 'Wed', 'D', 'G014-E'),
        lab('07', 'Sun', 'C', 'G007D'),
        lab('08', 'Sun', 'A', 'G0010D'),
        lab('09', 'Mon', 'D', 'G015-E'),
        lab('10', 'Tue', 'B', 'G016-E'),
        lab('11', 'Sun', 'A', 'G014-E'),
        lab('12', 'Sun', 'C', 'G014-E'),
      ],
      tutorials: [],
    },

    {
      name: 'Instructor Not Assigned',
      unassigned: true,
      lectures: [],
      labs: [
        lab('13', 'Sun', 'D', 'S043-E'),
        lab('14', 'Sun', 'E', 'S043-E'),
        lab('15', 'Mon', 'A', 'G009-D'),
        lab('16', 'Sun', 'B', 'G009-D'),
      ],
      tutorials: [],
    },
  ],
};

const csai202: Course = {
  id: 'csai202',
  code: 'CSAI 202',
  name: 'Introduction to Database Systems',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Yousry Abdelazeem Abdelazeem',
      lectures: [
        lec('01', 'Mon', 'B', 'G038B'),
        lec('02', 'Mon', 'E', 'G038B'),
      ],
      labs: [
        lab('01', 'Tue', 'D', 'G011-E'),
        lab('02', 'Tue', 'B', 'G011-E'),
        lab('03', 'Tue', 'B', 'G012-E'),
        lab('04', 'Tue', 'B', 'G015-D'),
        lab('05', 'Tue', 'C', 'G015-D'),
        lab('06', 'Wed', 'B', 'G011-E'),
        lab('07', 'Wed', 'E', 'G016-E'),
        lab('08', 'Wed', 'A', 'G012-E'),
      ],
      tutorials: [],
    },
    {
      name: 'Ashraf Hendam Hendam',
      lectures: [
        lec('03', 'Sun', 'B', 'G033B'),
      ],
      labs: [],
      tutorials: [],
    },
    {
      name: 'Instructor Not Assigned',
      unassigned: true,
      lectures: [],
      labs: [
        lab('09', 'Tue', 'C', 'G012-E'),
        lab('10', 'Tue', 'D', 'G012-E'),
        lab('11', 'Wed', 'A', 'G013-E'),
        lab('12', 'Sun', 'E', 'G0011D'),
        lab('13', 'Mon', 'E', 'S043-E'),
        lab('14', 'Mon', 'A', 'G015-D'),
        lab('15', 'Sun', 'E', 'G009-D'),
        lab('16', 'Mon', 'E', 'G011-E'),
      ],
      tutorials: [],
    },
  ],
};

const csai205: Course = {
  id: 'csai205',
  code: 'CSAI 205',
  name: 'Fundamentals of Circuits and Electronics',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Mohamed Maher Ata',
      lectures: [
        lec('01', 'Mon', 'A', 'G019-B'),
        lec('02', 'Mon', 'D', 'G025B'),
        lec('03', 'Tue', 'B', 'G006-B'),
      ],
      labs: [
        lab('01', 'Tue', 'A', 'G012-E'),
        lab('02', 'Tue', 'B', 'G014-E'),
        lab('03', 'Tue', 'E', 'G014-E'),
        lab('04', 'Wed', 'B', 'G009-D'),
        lab('05', 'Sun', 'B', 'S043-E'),
        lab('06', 'Sun', 'C', 'S043-E'),
        lab('07', 'Sun', 'A', 'S043-E'),
        lab('08', 'Sun', 'B', 'S001-A'),
        lab('09', 'Sun', 'C', 'S001-A'),
        lab('10', 'Sun', 'D', 'S001-A'),
        lab('11', 'Mon', 'D', 'S001-A'),
        lab('12', 'Mon', 'E', 'S001-A'),
      ],
      tutorials: [],
    },
  ],
};

const math105: Course = {
  id: 'math105',
  code: 'MATH 105',
  name: 'Probability and Statistics',
  c: 4,
  credits: 3,
  instructors: [
    {
      name: 'Walaa El-Sharkawy El-Sharkawy',
      lectures: [
        lec('01', 'Tue', 'A', 'G025B'),
      ],
      labs: [],
      tutorials: [
        tut('01', 'Tue', 'C', 'G009-B'),
        tut('02', 'Wed', 'E', 'G009-B'),
        tut('03', 'Tue', 'D', 'G008-C'),
      ],
    },
    {
      name: 'Mohamed Fawzy Fawzy',
      lectures: [
        lec('02', 'Wed', 'D', 'G019-B'),
      ],
      labs: [],
      tutorials: [
        tut('04', 'Sun', 'A', 'G008-C'),
        tut('05', 'Tue', 'A', 'G008-C'),
        tut('06', 'Sun', 'C', 'G008-C'),
      ],
    },
    {
      name: 'Ahmed El-Deeb',
      lectures: [
        lec('03', 'Tue', 'B', 'G025B'),
      ],
      labs: [],
      tutorials: [],
    },
    {
      name: 'Instructor Not Assigned',
      unassigned: true,
      lectures: [
        lec('04', 'Wed', 'D', 'G006-B'),
      ],
      labs: [],
      tutorials: [
        tut('07', 'Mon', 'E', 'F004-D'),
        tut('08', 'Sun', 'B', 'G035-B'),
        tut('09', 'Mon', 'E', 'F001-D'),
        tut('10', 'Wed', 'E', 'F011-D'),
        tut('11', 'Mon', 'D', 'F32-B4'),
      ],
    },
  ],
};

const it205: Course = {
  id: 'it205',
  code: 'IT 205',
  name: 'Enterprise System Architecture',
  c: 5,
  credits: 2,
  group: 'slot5',
  instructors: [
    {
      name: 'Mohamed Mahdy',
      lectures: [lec('01', 'Wed', 'A', 'F022-E')],
      labs: [lab('01', 'Mon', 'D', 'S043-E')],
      tutorials: [],
    },
  ],
};

const dsai203: Course = {
  id: 'dsai203',
  code: 'DSAI 203',
  name: 'Data Integration and Visualization',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Saeed Mohsen',
      lectures: [
        lec('01', 'Tue', 'A', 'G006-B'),
      ],
      labs: [
        lab('01', 'Wed', 'A', 'G0012D'),
        lab('02', 'Wed', 'A', 'S001-A'),
        lab('03', 'Wed', 'B', 'S001-A'),
        lab('04', 'Wed', 'D', 'S001-A'),
      ],
      tutorials: [],
    },
    {
      name: 'Mohamed Elhalaby Elhalaby',
      lectures: [
        lec('02', 'Mon', 'B', 'G033B'),
        lec('03', 'Mon', 'A', 'G033B'),
      ],
      labs: [
        lab('05', 'Wed', 'E', 'S001-A'),
        lab('06', 'Tue', 'A', 'S001-A'),
        lab('07', 'Tue', 'C', 'S001-A'),
        lab('08', 'Tue', 'B', 'S001-A'),
        lab('09', 'Wed', 'B', 'S043-E'),
        lab('10', 'Wed', 'A', 'S043-E'),
        lab('11', 'Wed', 'D', 'S043-E'),
        lab('12', 'Wed', 'E', 'S043-E'),
      ],
      tutorials: [],
    },
  ],
};

/* ===================== NEW: CSAI 203 (Software major) ===================== */
const csai203: Course = {
  id: 'csai203',
  code: 'CSAI 203',
  name: 'Introduction to Software Engineering',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Mohamed Sami Rakha',
      lectures: [lec('01', 'Sun', 'D', 'G006-B')],
      labs: [
        lab('01', 'Mon', 'E', 'G0011D'),
        lab('02', 'Mon', 'A', 'G014-E'),
        lab('03', 'Mon', 'E', 'G014-E'),
        lab('04', 'Mon', 'A', 'G011-E'),
      ],
      tutorials: [],
    },
    {
      name: 'Sabah Sayed Sayed',
      lectures: [lec('02', 'Sun', 'A', '')],
      labs: [
        lab('05', 'Wed', 'A', 'G015-E'),
        lab('06', 'Mon', 'C', 'G009-D'),
        lab('07', 'Tue', 'C', 'G011-E'),
        lab('08', 'Tue', 'A', 'G011-E'),
      ],
      tutorials: [],
    },
    {
      name: 'Instructor Not Assigned',
      unassigned: true,
      lectures: [lec('03', 'Sun', 'D', 'G033B')],
      labs: [
        lab('09', 'Tue', 'C', 'G013-E'),
        lab('10', 'Tue', 'D', 'G013-E'),
        lab('11', 'Tue', 'C', 'G014-E'),
        lab('12', 'Tue', 'B', 'G013-E'),
      ],
      tutorials: [],
    },
  ],
};

/* ===================== NEW: PHYS 104 (Software major) ===================== */
const phys104: Course = {
  id: 'phys104',
  code: 'PHYS 104',
  name: 'Physics 2',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Ashraf Abdelwahed',
      lectures: [
        lecH('01', 'Tue', 12, 14, 'F027B1'),
      ],
      labs: [],
      tutorials: [
        tutH('01', 'Sun', 8, 9, 'F026B1'),
        tutH('02', 'Sun', 9, 10, 'F026B1'),
        tutH('03', 'Mon', 15, 16, 'F004-D'),
        tutH('04', 'Mon', 14, 15, 'F014-E'),
      ],
    },
    {
      name: 'Essam Mohamed Aly Karamani / Ashraf Abdelwahed',
      lectures: [],
      labs: [
        labH('01', 'Mon', 10, 12, 'S26-B3'),
        labH('02', 'Mon', 14, 16, 'S26-B3'),
        labH('03', 'Sun', 10, 12, 'S26-B3'),
        labH('04', 'Sun', 14, 16, 'S26-B3'),
      ],
      tutorials: [],
    },
  ],
};
/* ==================================================================== */
/* Year 3 & Year 4 courses                                               */
/* ==================================================================== */

const csai301: Course = {
  id: 'csai301',
  code: 'CSAI 301',
  name: 'Artificial Intelligence',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Sabah Sayed Sayed',
      lectures: [
        lec('01', 'Sun', 'B', 'G011-B'),
      ],
      labs: [
        lab('01', 'Mon', 'B', 'G016-E'),
        lab('02', 'Mon', 'A', 'G016-E'),
        lab('03', 'Mon', 'B', 'G0012D'),
        lab('04', 'Mon', 'E', 'G0012D'),
      ],
      tutorials: [],
    },
    {
      name: 'Instructor Not Assigned',
      unassigned: true,
      lectures: [],
      labs: [
        lab('05', 'Sun', 'D', ''),
        lab('06', 'Mon', 'A', 'G012-E'),
      ],
      tutorials: [],
    },
  ],
};

const dsai307: Course = {
  id: 'dsai307',
  code: 'DSAI 307',
  name: 'Statistical Inference',
  c: 2,
  credits: 2,
  instructors: [
    {
      name: 'Rasha Mohamed Mandouh',
      lectures: [lecH('01', 'Sun', 8, 10, 'G011-B')],
      labs: [
        labH('01', 'Mon', 8, 10, 'S043-E'),
        labH('02', 'Tue', 8, 10, 'S043-E'),
        labH('03', 'Mon', 10, 12, 'S001-A'),
        labH('04', 'Tue', 14, 16, 'S043-E'),
      ],
      tutorials: [],
    },
  ],
};

const dsai308: Course = {
  id: 'dsai308',
  code: 'DSAI 308',
  name: 'Deep Learning',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Khaled El Sayed El Sayed',
      lectures: [
        lec('01', 'Tue', 'C', 'F30-B4'),
      ],
      labs: [
        lab('01', 'Sun', 'C', 'G016-E'),
        lab('02', 'Tue', 'E', 'G0010D'),
        lab('03', 'Wed', 'B', 'G006-D'),
      ],
      tutorials: [],
    },
  ],
};

const math303: Course = {
  id: 'math303',
  code: 'MATH 303',
  name: 'Linear and Non-linear Programming for CS',
  c: 4,
  credits: 3,
  instructors: [
    {
      name: 'Ahmed Abdelsamea',
      lectures: [lecH('01', 'Wed', 8, 10, 'G006-B')],
      labs: [],
      tutorials: [
        tutH('01', 'Sun', 14, 16, 'F012-D'),
        tutH('02', 'Sun', 12, 14, 'F013-E'),
        tutH('03', 'Tue', 14, 16, 'F031B4'),
      ],
    },
  ],
};

const dsai403: Course = {
  id: 'dsai403',
  code: 'DSAI 403',
  name: 'Nature Inspired Computation',
  c: 5,
  credits: 3,
  instructors: [
    {
      name: 'Mohamed Maher Ata',
      lectures: [lecH('01', 'Tue', 8, 10, 'G004-C')],
      labs: [
        labH('01', 'Tue', 10, 12, 'S043-E'),
        labH('02', 'Sun', 16, 18, 'S001-A'),
        labH('03', 'Sun', 14, 16, 'G009-D'),
      ],
      tutorials: [],
    },
  ],
};

const csai302: Course = {
  id: 'csai302',
  code: 'CSAI 302',
  name: 'Advanced Database Systems',
  c: 6,
  credits: 3,
  instructors: [
    {
      name: 'Yousry Abdelazeem Abdelazeem',
      lectures: [lecH('01', 'Tue', 14, 16, 'G006-B')],
      labs: [
        labH('01', 'Wed', 14, 16, 'G015-E'),
        labH('02', 'Wed', 10, 12, 'G015-E'),
        labH('03', 'Mon', 14, 16, 'G013-E'),
        labH('04', 'Wed', 10, 12, 'G014-E'),
      ],
      tutorials: [],
    },
  ],
};

const dsai402: Course = {
  id: 'dsai402',
  code: 'DSAI 402',
  name: 'Reinforcement Learning',
  c: 7,
  credits: 3,
  instructors: [
    {
      name: 'Mohamed Ghalwash',
      lectures: [lecH('01', 'Mon', 14, 16, 'F25-B4')],
      labs: [
        labH('01', 'Tue', 16, 18, 'S001-A'),
        labH('02', 'Wed', 14, 16, 'G020-E'),
        labH('03', 'Wed', 16, 18, 'G012-E'),
      ],
      tutorials: [],
    },
  ],
};

const dsai456: Course = {
  id: 'dsai456',
  code: 'DSAI 456',
  name: 'Speech Recognition',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Mohamed Ghalwash',
      lectures: [lecH('01', 'Mon', 8, 10, 'G035-B')],
      labs: [
        labH('01', 'Mon', 10, 12, 'S043-E'),
        labH('02', 'Tue', 12, 14, 'S043-E'),
        labH('03', 'Tue', 16, 18, 'S043-E'),
      ],
      tutorials: [],
    },
  ],
};

const csai498: Course = {
  id: 'csai498',
  code: 'CSAI 498',
  name: 'Senior Project - Part 1',
  c: 2,
  credits: 1,
  noFixedSchedule: true,
  instructors: [
    {
      name: 'Instructor not assigned',
      unassigned: true,
      lectures: [],
      labs: [],
      tutorials: [],
      note: 'No fixed schedule published in self-service — the project is arranged individually with a supervisor.',
    },
  ],
};

const math205: Course = {
  id: 'math205',
  code: 'MATH 205',
  name: 'Discrete Mathematics for Computational Sciences',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Ahmed Etman Etman',
      lectures: [
        lec('01', 'Wed', 'B', 'F012-D'),
      ],
      labs: [],
      tutorials: [],
    },
    {
      name: 'Instructor Not Assigned',
      unassigned: true,
      lectures: [],
      labs: [],
      tutorials: [
        tutH('01', 'Thu', 12, 14, 'Online'),
      ],
    },
  ],
};

const it308: Course = {
  id: 'it308',
  code: 'IT 308',
  name: 'Cloud Computing Architecture',
  c: 3,
  credits: 2,
  instructors: [
    {
      name: 'Sahar Abdel Rahman',
      lectures: [
        lecH('01', 'Tue', 12, 14, 'F031B4'),
      ],
      labs: [
        labH('01', 'Tue', 14, 16, 'S001-A'),
      ],
      tutorials: [],
    },
  ],
};

const itns301: Course = {
  id: 'itns301',
  code: 'ITNS 301',
  name: 'Network Administration',
  c: 4,
  credits: 2,
  instructors: [
    {
      name: 'Tarek Mohamed Salem',
      lectures: [lecH('01', 'Thu', 14, 16, 'Online')],
      labs: [labH('01', 'Mon', 10, 12, 'G009-D')],
      tutorials: [],
    },
  ],
};

const itns403: Course = {
  id: 'itns403',
  code: 'ITNS 403',
  name: 'Storage Area Networks',
  c: 6,
  credits: 3,
  instructors: [
    {
      name: 'Tarek Mohamed Salem',
      lectures: [lecH('01', 'Thu', 8, 10, 'Online')],
      labs: [labH('01', 'Sun', 12, 14, 'G009-D')],
      tutorials: [],
    },
  ],
};

const itns404: Course = {
  id: 'itns404',
  code: 'ITNS 404',
  name: 'Net Performance Monitoring & Trbl-shooting',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Mohamed Mahdy',
      lectures: [
        lec('01', 'Thu', 'E', 'Online'),
      ],
      labs: [
        lab('01', 'Mon', 'B', 'G011-E'),
      ],
      tutorials: [],
    },
  ],
};

const itns406: Course = {
  id: 'itns406',
  code: 'ITNS 406',
  name: 'Network Resilience and Hardening',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Mohamed Mahdy',
      lectures: [lecH('01', 'Tue', 14, 16, 'G008-B')],
      labs: [labH('01', 'Mon', 8, 10, 'S001-A')],
      tutorials: [],
    },
  ],
};

const it402: Course = {
  id: 'it402',
  code: 'IT 402',
  name: 'Fundamentals of Cybersecurity & Encryption',
  c: 2,
  credits: 3,
  instructors: [
    {
      name: 'Sahar Abdel Rahman',
      lectures: [lecH('01', 'Tue', 10, 12, 'G018-E')],
      labs: [labH('01', 'Wed', 16, 18, 'G015-E')],
      tutorials: [],
    },
  ],
};

const it411: Course = {
  id: 'it411',
  code: 'IT 411',
  name: 'Enterprise Resources Planning',
  c: 3,
  credits: 3,
  instructors: [
    {
      name: 'Sahar Abdel Rahman',
      lectures: [lecH('01', 'Mon', 14, 16, 'G033B')],
      labs: [labH('01', 'Mon', 16, 18, 'G009-D')],
      tutorials: [],
    },
  ],
};
const sw301: Course = {
  id: 'sw301',
  code: 'SW 301',
  name: 'Object-Oriented Analysis and Design',
  c: 4,
  credits: 3,
  instructors: [
    {
      name: 'Instructor not assigned',
      unassigned: true,
      lectures: [lecH('01', 'Sun', 8, 10, 'G007-C')],
      labs: [
        labH('01', 'Sun', 12, 14, 'F012-E'),
        labH('02', 'Sun', 14, 16, 'F011-D'),
      ],
      tutorials: [],
    },
  ],
};

const sw252: Course = {
  id: 'sw252',
  code: 'SW 252',
  name: 'Embedded Systems',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Manar Shaker',
      lectures: [
        lec('01', 'Wed', 'B', 'F006-D'),
      ],
      labs: [
        lab('01', 'Tue', 'B', 'G015-E'),
      ],
      tutorials: [],
    },
    {
      name: 'Instructor Not Assigned',
      unassigned: true,
      lectures: [],
      labs: [
        lab('02', 'Tue', 'D', 'G015-E'),
        lab('03', 'Tue', 'A', 'G015-E'),
      ],
      tutorials: [],
    },
  ],
};

const sw302: Course = {
  id: 'sw302',
  code: 'SW 302',
  name: 'User Interface Development',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Mohamed Sami Rakha',
      lectures: [
        lec('01', 'Mon', 'B', 'F019-E'),
      ],
      labs: [
        lab('01', 'Tue', 'A', 'G015-D'),
      ],
      tutorials: [],
    },
    {
      name: 'Instructor Not Assigned',
      unassigned: true,
      lectures: [],
      labs: [
        lab('02', 'Wed', 'E', 'G018-E'),
        lab('03', 'Tue', 'E', 'G012-E'),
      ],
      tutorials: [],
    },
  ],
};

const swapd301: Course = {
  id: 'swapd301',
  code: 'SWAPD 301',
  name: 'Software Systems Requirements Dev',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Dina Ezzat',
      lectures: [
        lec('01', 'Wed', 'D', 'F012-E'),
      ],
      labs: [
        lab('01', 'Wed', 'A', 'G014-E'),
      ],
      tutorials: [],
    },
    {
      name: 'Instructor Not Assigned',
      unassigned: true,
      lectures: [],
      labs: [
        lab('02', 'Wed', 'A', 'G018-E'),
      ],
      tutorials: [],
    },
  ],
};

const swgcg301: Course = {
  id: 'swgcg301',
  code: 'SWGCG 301',
  name: 'Computer Graphics and Multimedia Systems',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Yahia Zakaria Abd El-Samee El-Wahed',
      lectures: [lecH('01', 'Mon', 8, 10, 'F009-D')],
      labs: [labH('01', 'Sun', 16, 18, 'G017-E')],
      tutorials: [],
    },
  ],
};

const swhci301: Course = {
  id: 'swhci301',
  code: 'SWHCI 301',
  name: 'Prototyping Algorithmic Experiences',
  c: 2,
  credits: 3,
  instructors: [
    {
      name: 'Hussein Jad',
      lectures: [lecH('01', 'Thu', 12, 14, 'Online')],
      labs: [labH('01', 'Sun', 14, 16, 'G015-D')],
      tutorials: [],
    },
  ],
};

const sw401: Course = {
  id: 'sw401',
  code: 'SW 401',
  name: 'Parallel and Distributed Computing',
  c: 3,
  credits: 3,
  instructors: [
    {
      name: 'Samar Elbedwehy',
      lectures: [lecH('01', 'Sun', 10, 12, 'F008-E')],
      labs: [
        labH('01', 'Mon', 14, 16, 'G016-E'),
        labH('02', 'Mon', 16, 18, 'G015-E'),
      ],
      tutorials: [],
    },
  ],
};

const swapd401: Course = {
  id: 'swapd401',
  code: 'SWAPD 401',
  name: 'Software Testing, Validation, and QA',
  c: 4,
  credits: 3,
  instructors: [
    {
      name: 'Instructor not assigned',
      unassigned: true,
      lectures: [
        lecH('01', 'Tue', 16, 18, 'F015-D'),
      ],
      labs: [
        labH('01', 'Wed', 8, 10, 'G016-E'),
        labH('02', 'Wed', 10, 12, 'G016-E'),
      ],
      tutorials: [],
    },
  ],
};

const swapd402: Course = {
  id: 'swapd402',
  code: 'SWAPD 402',
  name: 'Mobile Application Development',
  c: 5,
  credits: 3,
  instructors: [
    {
      name: 'Yousry Abdelazeem Abdelazeem',
      lectures: [
        lecH('01', 'Tue', 10, 12, 'F012-D'),
      ],
      labs: [
        labH('01', 'Wed', 10, 12, 'F013-E'),
      ],
      tutorials: [],
    },
  ],
};

const sw402: Course = {
  id: 'sw402',
  code: 'SW 402',
  name: 'Software Project Management',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Instructor Not Assigned',
      unassigned: true,
      lectures: [
        lec('01', 'Tue', 'D', 'F006-D'),
      ],
      labs: [
        lab('01', 'Sun', 'A', 'F016-E'),
        lab('02', 'Sun', 'A', 'G009-D'),
      ],
      tutorials: [],
    },
  ],
};

const swgcg401: Course = {
  id: 'swgcg401',
  code: 'SWGCG 401',
  name: 'Design & Geom Modeling for Vis & Comm',
  c: 7,
  credits: 3,
  instructors: [
    {
      name: 'Instructor not assigned',
      unassigned: true,
      lectures: [lecH('01', 'Sun', 12, 14, 'G018-E')],
      labs: [labH('01', 'Tue', 16, 18, 'G015-E')],
      tutorials: [],
    },
  ],
};

const swgcg402: Course = {
  id: 'swgcg402',
  code: 'SWGCG 402',
  name: 'Visual Effects Production',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Hussein Jad',
      lectures: [lecH('01', 'Thu', 8, 10, 'Online')],
      labs: [labH('01', 'Mon', 10, 12, 'G015-E')],
      tutorials: [],
    },
  ],
};

const swhci401: Course = {
  id: 'swhci401',
  code: 'SWHCI 401',
  name: 'Human Information Processing and AI',
  c: 2,
  credits: 3,
  instructors: [
    {
      name: 'Sherif Hamdy ElGohary',
      lectures: [
        lecH('01', 'Thu', 16, 18, 'University of Science and Technology'),
      ],
      labs: [labH('01', 'Sun', 16, 18, 'G015-E')],
      tutorials: [],
    },
  ],
};

const swhci402: Course = {
  id: 'swhci402',
  code: 'SWHCI 402',
  name: 'AI Based Products and Services',
  c: 3,
  credits: 3,
  instructors: [
    {
      name: 'Hussein Jad',
      lectures: [lecH('01', 'Thu', 14, 16, 'Online')],
      labs: [labH('01', 'Mon', 8, 10, 'G015-E')],
      tutorials: [],
    },
  ],
};


/* ==================================================================== */
/* YEAR 1 + SCH COURSES                                                  */
/* ==================================================================== */

const csai101: Course = {
  id: 'csai101',
  code: 'CSAI 101',
  name: 'Fundamentals of Programming and Computer Science',
  c: 1,
  credits: 2,
  instructors: [
    {
      name: 'Ghada Dahy',
      lectures: [
        lecH('03', 'Wed', 8, 10, 'G033B'),
        lecH('04', 'Wed', 10, 12, 'F009-D'),
      ],
      labs: [
        labH('07', 'Wed', 10, 12, 'G0012D'),
        labH('08', 'Wed', 10, 12, 'G007D'),
        labH('09', 'Mon', 10, 12, 'G015-D'),
        labH('10', 'Tue', 14, 16, 'G009-D'),
        labH('11', 'Sun', 12, 14, 'G012-E'),
        labH('12', 'Sun', 12, 14, 'G011-E'),
      ],
      tutorials: [],
    },
    {
      name: 'Ibrahim Eldesouky',
      lectures: [
        lecH('06', 'Tue', 10, 12, 'G033B'),
        lecH('07', 'Tue', 12, 14, 'F011-E'),
      ],
      labs: [
        labH('16', 'Sun', 12, 14, 'G0011D'),
        labH('17', 'Sun', 12, 14, 'G0012D'),
        labH('18', 'Sun', 8, 10, 'G0012D'),
        labH('19', 'Sun', 14, 16, 'G0011D'),
        labH('20', 'Sun', 14, 16, 'G0010D'),
      ],
      tutorials: [],
    },
  ],
};

const csai102: Course = {
  id: 'csai102',
  code: 'CSAI 102',
  name: 'Digital Logic and Computer Architecture',
  c: 2,
  credits: 3,
  instructors: [
    {
      name: 'Elmahdy Maree Maree',
      lectures: [
        lecH('03', 'Sun', 12, 14, ''),
        lecH('04', 'Sun', 14, 16, 'G019-B'),
      ],
      labs: [
        labH('07', 'Tue', 14, 16, 'G016-E'),
        labH('08', 'Wed', 16, 18, 'G008-E'),
        labH('09', 'Wed', 10, 12, 'G020-E'),
        labH('10', 'Mon', 10, 12, 'G020-E'),
        labH('11', 'Mon', 10, 12, 'G008-E'),
        labH('12', 'Mon', 16, 18, 'G008-E'),
      ],
      tutorials: [],
    },
    {
      name: 'Mohamed Ghalwash',
      lectures: [
        lecH('06', 'Tue', 12, 14, 'G008-C'),
      ],
      labs: [
        labH('16', 'Sun', 14, 16, 'G020-E'),
        labH('17', 'Sun', 8, 10, 'G020-E'),
        labH('18', 'Sun', 12, 14, 'G020-E'),
      ],
      tutorials: [],
    },
    {
      name: 'Ibrahim Swelam',
      lectures: [
        lecH('07', 'Sun', 12, 14, 'G011-B'),
      ],
      labs: [
        labH('19', 'Tue', 8, 10, 'G016-E'),
        labH('20', 'Mon', 8, 10, 'G020-E'),
      ],
      tutorials: [],
    },
  ],
};

const csai252: Course = {
  id: 'csai252',
  code: 'CSAI 252',
  name: 'Introduction to Computer Networks',
  c: 3,
  credits: 3,
  instructors: [
    {
      name: 'Heba Aty Aty',
      lectures: [
        lecH('03', 'Wed', 14, 16, 'G011-B'),
        lecH('04', 'Wed', 8, 10, 'G019-B'),
      ],
      labs: [
        labH('07', 'Sun', 10, 12, 'G012-E'),
        labH('08', 'Sun', 8, 10, 'G013-E'),
        labH('09', 'Sun', 10, 12, 'G013-E'),
        labH('10', 'Mon', 16, 18, 'G011-E'),
        labH('11', 'Mon', 14, 16, 'G011-E'),
        labH('12', 'Mon', 14, 16, 'G012-E'),
        labH('16', 'Mon', 10, 12, 'G012-E'),
        labH('17', 'Mon', 16, 18, 'G013-E'),
        labH('18', 'Mon', 10, 12, 'G013-E'),
      ],
      tutorials: [],
    },
    {
      name: 'Tarek Mohamed Salem',
      lectures: [
        lecH('07', 'Thu', 10, 12, 'Online'),
      ],
      labs: [],
      tutorials: [],
      note: 'Online lecture — no lab published under this instructor.',
    },
    {
      name: 'Mohamed ElMikaty',
      lectures: [],
      labs: [
        labH('19', 'Mon', 8, 10, 'G013-E'),
        labH('20', 'Sun', 10, 12, 'G014-E'),
        labH('21', 'Wed', 14, 16, 'G0010D'),
      ],
      tutorials: [],
      note: 'No lecture assigned to this instructor in self-service — lab sections only.',
    },
    {
      name: 'Instructor not assigned',
      unassigned: true,
      lectures: [],
      labs: [
        labH('22', 'Sun', 14, 16, 'G014-E'),
        labH('23', 'Mon', 10, 12, 'G014-E'),
      ],
      tutorials: [],
      note: 'Sections listed without an instructor in self-service — kept together exactly as published.',
    },
  ],
};

const csai100: Course = {
  id: 'csai100',
  code: 'CSAI 100',
  name: 'Intro to Computational Science and AI',
  c: 6,
  credits: 1,
  instructors: [
    {
      name: 'Khaled El Sayed El Sayed',
      lectures: [lecH('01', 'Wed', 11, 12, 'G008-C')],
      labs: [],
      tutorials: [],
    },
  ],
};

const math104: Course = {
  id: 'math104',
  code: 'MATH 104',
  name: 'Linear Algebra',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Waleed Abdel Magued',
      lectures: [
        lecH('01', 'Sun', 14, 16, 'G025B'),
      ],
      labs: [],
      tutorials: [
        tutH('01', 'Mon', 8, 10, 'F012-D'),
        tutH('02', 'Sun', 16, 18, 'F012-D'),
        tutH('03', 'Tue', 12, 14, 'F011-E'),
      ],
    },
    {
      name: 'Mohamed Fawzy Fawzy',
      lectures: [
        lecH('02', 'Wed', 16, 18, 'G004-C'),
      ],
      labs: [],
      tutorials: [
        tutH('04', 'Sun', 12, 14, 'F009-D'),
        tutH('05', 'Sun', 12, 14, 'F014-E'),
        tutH('06', 'Mon', 8, 10, 'F013-E'),
      ],
    },
  ],
};

const dsai104: Course = {
  id: 'dsai104',
  code: 'DSAI 104',
  name: 'Knowledge Representation and Reasoning',
  c: 4,
  credits: 2,
  instructors: [
    {
      name: 'Saeed Mohsen',
      lectures: [
        lecH('01', 'Thu', 16, 18, 'Online'),
      ],
      labs: [
        labH('01', 'Tue', 16, 18, 'G007D'),
      ],
      tutorials: [],
    },
  ],
};

const math103: Course = {
  id: 'math103',
  code: 'MATH 103',
  name: 'Calculus for Computational Sciences',
  c: 1,
  credits: 3,
  instructors: [
    {
      name: 'Azza Adel Ahmed Rabie',
      lectures: [
        lecH('04', 'Tue', 12, 14, 'G011-B'),
        lecH('06', 'Sun', 10, 12, 'G019-B'),
      ],
      labs: [],
      tutorials: [
        tutH('08', 'Tue', 8, 10, 'F011-D'),
        tutH('09', 'Tue', 8, 10, 'F012-D'),
        tutH('10', 'Wed', 14, 16, 'F012-D'),
        tutH('12', 'Tue', 14, 16, 'F012-D'),
      ],
    },
    {
      name: 'Ahmed Etman Etman',
      lectures: [],
      labs: [],
      tutorials: [
        tutH('14', 'Mon', 8, 10, 'F007-D'),
        tutH('17', 'Mon', 8, 10, 'F008-D'),
      ],
    },
    {
      name: 'Ahmed Said abdelmawgoud',
      lectures: [],
      labs: [],
      tutorials: [
        tutH('19', 'Tue', 14, 16, 'F011-D'),
        tutH('20', 'Tue', 14, 16, 'F015-E'),
      ],
    },
  ],
};

const csai151: Course = {
  id: 'csai151',
  code: 'CSAI 151',
  name: 'Object-Oriented Programming',
  c: 2,
  credits: 3,
  noFixedSchedule: true,
  instructors: [
    {
      name: 'Instructor not assigned',
      unassigned: true,
      lectures: [],
      labs: [],
      tutorials: [],
      note: 'Not published in self-service — listed only in the program course map (3 Cr); nothing is invented.',
    },
  ],
};

const it101: Course = {
  id: 'it101',
  code: 'IT 101',
  name: 'Shell and Script Programming with UNIX',
  c: 3,
  credits: 2,
  noFixedSchedule: true,
  instructors: [
    {
      name: 'Instructor not assigned',
      unassigned: true,
      lectures: [],
      labs: [],
      tutorials: [],
      note: 'Not published in self-service — listed only in the IT program course map (2 Cr); nothing is invented.',
    },
  ],
};

const it102: Course = {
  id: 'it102',
  code: 'IT 102',
  name: 'Ethical Hacking and Defense',
  c: 5,
  credits: 2,
  noFixedSchedule: true,
  instructors: [
    {
      name: 'Instructor not assigned',
      unassigned: true,
      lectures: [],
      labs: [],
      tutorials: [],
      note: 'Not published in self-service — listed only in the IT program course map (2 Cr); nothing is invented.',
    },
  ],
};

const it103: Course = {
  id: 'it103',
  code: 'IT 103',
  name: 'Fundamentals of Information and Communication Systems',
  c: 6,
  credits: 2,
  noFixedSchedule: true,
  instructors: [
    {
      name: 'Instructor not assigned',
      unassigned: true,
      lectures: [],
      labs: [],
      tutorials: [],
      note: 'Not published in self-service — listed only in the IT program course map (2 Cr); nothing is invented.',
    },
  ],
};

const dsai103: Course = {
  id: 'dsai103',
  code: 'DSAI 103',
  name: 'Data Acquisition in Data Science (ETL)',
  c: 2,
  credits: 3,
  noFixedSchedule: true,
  instructors: [
    {
      name: 'Instructor not assigned',
      unassigned: true,
      lectures: [],
      labs: [],
      tutorials: [],
      note: 'Not published in self-service — listed only in the program course map (3 Cr); nothing is invented.',
    },
  ],
};

const sw151: Course = {
  id: 'sw151',
  code: 'SW 151',
  name: 'Computer Architecture and Organization',
  c: 4,
  credits: 3,
  noFixedSchedule: true,
  instructors: [
    {
      name: 'Instructor not assigned',
      unassigned: true,
      lectures: [],
      labs: [],
      tutorials: [],
      note: 'Not published in self-service — listed only in the Software program course map (3 Cr); nothing is invented.',
    },
  ],
};

const phys103: Course = {
  id: 'phys103',
  code: 'PHYS 103',
  name: 'Physics 1',
  c: 1,
  credits: 3,
  noFixedSchedule: true,
  instructors: [
    {
      name: 'Instructor not assigned',
      unassigned: true,
      lectures: [],
      labs: [],
      tutorials: [],
      note: 'Not published in self-service — listed only in the Software program course map (3 Cr); nothing is invented.',
    },
  ],
};


/* =============================== COURSES ============================= */

export const COURSES: Course[] = [
  csai201,
  csai202,
  csai205,
  math105,
  it205,
  dsai203,
  csai203,
  phys104,

  csai101,
  csai102,
  csai252,
  csai100,
  math104,
  dsai104,
  math103,
  csai151,
  it101,
  it102,
  it103,
  dsai103,
  sw151,
  phys103,

  // Year 3 / Year 4 additions
  csai301,
  dsai307,
  dsai308,
  math303,
  dsai403,
  csai302,
  dsai402,
  dsai456,
  csai498,
  math205,
  it308,
  itns301,
  itns403,
  itns404,
  itns406,
  it402,
  it411,
  sw301,
  sw252,
  sw302,
  swapd301,
  swgcg301,
  swhci301,
  sw401,
  swapd401,
  swapd402,
  sw402,
  swgcg401,
  swgcg402,
  swhci401,
  swhci402,

  ...SCH_ELECTIVE_COURSES,
];

export const COURSE_BY_ID: Record<string, Course> = Object.fromEntries(
  COURSES.map((c) => [c.id, c]),
);

export function instructorLabel(instr: Instructor): string {
  return instr.unassigned ? `${instr.name} (unassigned)` : instr.name;
}
