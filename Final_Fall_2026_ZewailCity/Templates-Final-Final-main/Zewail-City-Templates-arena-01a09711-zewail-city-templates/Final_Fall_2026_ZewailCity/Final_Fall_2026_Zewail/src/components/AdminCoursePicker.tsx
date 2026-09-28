import { useId, useState } from 'react';
import type { Course } from '../types';

export function AdminCoursePicker({ courses, value, onChange, label }: {
  courses: Course[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const resultsId = useId();
  const selected = courses.find(course => course.id === value);
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = courses.filter(course => {
    const text = `${course.code} ${course.name}`.toLocaleLowerCase();
    const compact = text.replace(/[^a-z0-9]/g, '');
    return words.every(word => text.includes(word) || compact.includes(word.replace(/[^a-z0-9]/g, '')));
  });
  const choose = (course: Course) => {
    onChange(course.id);
    setQuery(`${course.code} · ${course.name}`);
    setOpen(false);
  };

  return <div className="mt-3" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <label className="block text-xs font-semibold">{label}
      <input className="select mt-1 w-full" type="search" autoComplete="off" value={query}
        placeholder="Type course code or name, e.g. CSAI 201 or Data Structures"
        role="combobox" aria-autocomplete="list" aria-label={`Search ${label.toLowerCase()}`} aria-expanded={open} aria-controls={resultsId}
        onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && open && matches.length) { event.preventDefault(); choose(matches[0]); }
        }} />
    </label>
    {selected && <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Selected: {selected.code} · {selected.name}</p>}
    {open && <div id={resultsId} className="panel mt-1 max-h-56 overflow-y-auto p-1" role="listbox" aria-label="Matching courses">
      {matches.slice(0, 20).map(course => <button key={course.id} type="button" role="option" aria-selected={value === course.id}
        className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:opacity-75"
        onClick={() => choose(course)}>{course.code} · {course.name}</button>)}
      {!matches.length && <p className="p-3 text-xs" role="status">No matching course. Try its code or a word from its name.</p>}
      {matches.length > 20 && <p className="p-2 text-xs" style={{ color: 'var(--muted)' }}>Showing 20 of {matches.length}. Type more to narrow the results.</p>}
    </div>}
  </div>;
}
