# Preparing a new semester

Copy the four JSON files into `src/semester/`, retaining the current field shapes. Enter only confirmed Self-Service or supplied course data. Keep course IDs stable when a course is renamed. Add major/year course IDs in `majors.json`, sections and instructors in `courses.json` or `sch.json`, and dates/term/key in `semester.json`.

Run `npm run test:data`, `npm run typecheck`, `npm run build`, then the remaining `test:*` scripts before deploying. `test:data` reports missing rooms as warnings, rejects invalid days/times and broken references, and prints a dataset summary. Keep a copy of the old semester outside the active folder when switching terms. Update `dataLastVerified` only after checking the dataset against its source.

The template contains no academic facts. The live Fall 2026 dataset was copied directly from the existing typed data without changing any course, room, instructor or meeting.

For a faster import, use the private `/admin.html` workspace: paste verified Self-Service search result text, or upload CSV with `courseCode,subtype,section,day,start,end,room,instructor`. It stages sections for comparison and requires an attributable private save. Check the complete semester and export each saved JSON draft before the normal git review/CI. The importer never logs into Self-Service and never changes the public site. Keep each previous semester deployment at its original URL, publish the next term at a new URL and give it a new `semester.key` so old share links cannot be read against the next dataset. See `docs/SEMESTER_ROLLOVER.md` at the repository root.
