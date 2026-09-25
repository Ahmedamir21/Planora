# Semester Rollover Guide

This project is designed so a new semester should require **data updates, not feature rewrites**.

## Safe workflow

1. Create a branch from the current `main` branch and copy `semester-template/` as a starting point.
2. Fill in these four files in `src/semester/`, using only verified Self-Service data or facts supplied by the creators:
   - `semester.json`: term, year, session, start/end dates, verification date.
   - `courses.json`: course and published meeting data.
   - `majors.json`: available majors and course IDs by year.
   - `sch.json`: published SCH electives.
3. Run `npm run test:data`, `npm run typecheck`, `npm run build`, then the remaining `test:*` scripts from the Vite app directory.
4. Check the preview deployment for all four years, both themes, PWA update, sharing and calendar export before promoting it to production.

## What to change in semester.json

Change only the current-semester fields:

- `key` — unique stable id, e.g. `spring-2027-main`
- `term`
- `year`
- `session`
- `dataLastVerified`
- `calendarStartDate` and `calendarEndDate` for calendar export
- `publicHostLabel` only if the public domain changes
- `version` if you intentionally change the displayed version

The JSON files feed the existing adapters in `src/data/` and `src/config/semester.ts`; do not duplicate term facts in those adapters. **Do not change `LEGACY_UNTAGGED_SEMESTER_KEY`.** It permanently identifies old untagged links and saved state so future terms can reject them.

## Data rules enforced automatically

The CI data validator rejects:

- duplicate course IDs
- duplicate course codes in one active semester dataset
- major/year references to missing courses
- duplicate course IDs inside one year
- invalid day codes
- invalid start/end times
- zero or negative meeting durations
- missing section IDs
- invalid palette indexes
- invalid credit values
- courses marked `noFixedSchedule` that publish meetings
- scheduled courses that publish no meetings
- unassigned instructor buckets that are not marked `unassigned: true`

Missing rooms are allowed because Self-Service can legitimately omit them. CI prints them as warnings for manual review.

## IDs and share links

Keep a course `id` stable when it still represents the same course. The visible course code/name can change independently if the official data changes.

Share links are semester-tagged. A link from one semester is intentionally rejected by another semester instead of being mapped onto different section data.

Local saved planner state is also semester-tagged. Old state cannot silently populate a future semester.

## Locks and Assistant constraints

Course/section locks and persistent AI constraint chips are scoped to the current semester. Current Fall 2026 legacy values are migrated automatically; future semesters start clean.

## Before merging a new semester

Verify at least:

- one Year 1 schedule
- one Year 2 schedule
- one Year 3 schedule
- one Year 4 schedule
- one cross-year addition
- one SCH elective
- one course with multiple instructors
- one unassigned section
- one no-fixed-schedule course
- one real conflict
- one Best Schedule generation
- one share-link restore
- one Share as Image export
- one AI section change
- one AI conflict repair
- one course lock and one section lock

Then confirm CI is fully green and the preview deployment has no runtime errors.
