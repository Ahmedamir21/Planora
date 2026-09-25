import { useState } from 'react';
import type { Course, Day, Instructor, Meeting } from '../types';

type ComponentKey = 'lectures' | 'labs' | 'tutorials';
const components: ComponentKey[] = ['lectures', 'labs', 'tutorials'];
const days: Day[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** All edits remain in the browser draft until the main admin form records a source and saves. */
export function AdminCourseEditor({ courses, onChange }: { courses: Course[]; onChange: (next: Course[]) => void }) {
  const [selectedId, setSelectedId] = useState('');
  const [notice, setNotice] = useState('');
  const course = courses.find(item => item.id === selectedId);
  const stage = (edit: (target: Course) => void) => {
    const next = structuredClone(courses);
    const target = next.find(item => item.id === selectedId);
    if (!target) return;
    edit(target);
    onChange(next);
    setNotice('Staged in the browser draft. Review the comparison and save with a source to record it.');
  };
  const changeInstructor = (index: number, value: string) => stage(target => { target.instructors[index].name = value; });
  const changeMeeting = (i: number, kind: ComponentKey, j: number, edit: (meeting: Meeting) => void) => stage(target => edit(target.instructors[i][kind][j]));
  const changeTime = (i: number, kind: ComponentKey, j: number, field: 'start' | 'end', value: string) => {
    if (!/^\d{2}:\d{2}$/.test(value)) return;
    const [hour, minute] = value.split(':').map(Number);
    const minutes = hour * 60 + minute;
    if (minutes < 0 || minutes > 1440) return;
    changeMeeting(i, kind, j, meeting => { meeting[field] = minutes; });
  };

  return <div className="panel-soft mb-4 p-4">
    <h3 className="font-semibold">Edit one course</h3>
    <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Pick a course and change only the published field you checked in Self-Service. These edits stay in the private draft until you review and save them below.</p>
    <label className="mt-3 block text-xs font-semibold">Course
      <select className="select mt-1" value={selectedId} onChange={event => { setSelectedId(event.target.value); setNotice(''); }}>
        <option value="">Choose a course</option>
        {courses.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
      </select>
    </label>
    {course && <div className="mt-4 space-y-4">
      <p className="text-xs">Internal ID: <code>{course.id}</code> (kept stable for saved selections and links)</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold">Course code<input className="select mt-1" value={course.code} onChange={event => stage(target => { target.code = event.target.value; })} /></label>
        <label className="text-xs font-semibold">Course name<input className="select mt-1" value={course.name} onChange={event => stage(target => { target.name = event.target.value; })} /></label>
        <label className="text-xs font-semibold">Credits<input className="select mt-1" type="number" min="0" step="0.5" value={course.credits ?? ''} onChange={event => stage(target => { target.credits = event.target.value === '' ? undefined : Number(event.target.value); })} /></label>
      </div>
      {course.instructors.map((instructor: Instructor, i: number) => <div className="panel p-3" key={i}>
        <label className="block text-xs font-semibold">Instructor {i + 1}<input className="select mt-1" value={instructor.name} onChange={event => changeInstructor(i, event.target.value)} /></label>
        {components.map(kind => instructor[kind].map((meeting, j) => <div className="mt-3 grid gap-2 border-t pt-3 text-xs sm:grid-cols-5" key={`${kind}-${j}`} style={{ borderColor: 'var(--border)' }}>
          <label className="font-semibold">{meeting.type} section<input className="select mt-1" value={meeting.sec} onChange={event => changeMeeting(i, kind, j, item => { item.sec = event.target.value; })} /></label>
          <label className="font-semibold">Day<select className="select mt-1" value={meeting.day} onChange={event => changeMeeting(i, kind, j, item => { item.day = event.target.value as Day; })}>{days.map(day => <option key={day}>{day}</option>)}</select></label>
          <label className="font-semibold">Start<input className="select mt-1" type="time" value={clock(meeting.start)} onChange={event => changeTime(i, kind, j, 'start', event.target.value)} /></label>
          <label className="font-semibold">End<input className="select mt-1" type="time" value={clock(meeting.end)} onChange={event => changeTime(i, kind, j, 'end', event.target.value)} /></label>
          <label className="font-semibold">Room<input className="select mt-1" value={meeting.room} onChange={event => changeMeeting(i, kind, j, item => { item.room = event.target.value; })} /></label>
        </div>))}
      </div>)}
      {notice && <p role="status" className="text-xs">{notice}</p>}
    </div>}
  </div>;
}
