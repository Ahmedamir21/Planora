# Preparing a new semester

Copy the four JSON files into `src/semester/`, retaining the current field shapes. Enter only confirmed Self-Service or supplied course data. Keep course IDs stable when a course is renamed. Add major/year course IDs in `majors.json`, sections and instructors in `courses.json` or `sch.json`, and dates/term/key in `semester.json`.

Run `npm run test:data`, `npm run typecheck`, `npm run build`, then the remaining `test:*` scripts before deploying. `test:data` reports missing rooms as warnings, rejects invalid days/times and broken references, and prints a dataset summary. Keep a copy of the old semester outside the active folder when switching terms. Update `dataLastVerified` only after checking the dataset against its source.

The template contains no academic facts. The live Fall 2026 dataset was copied directly from the existing typed data without changing any course, room, instructor or meeting.
